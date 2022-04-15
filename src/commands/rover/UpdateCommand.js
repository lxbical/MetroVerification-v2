const Command = require("../Command")
const DiscordServer = require("../../DiscordServer")
const { Role } = require("discord.js")
const config = require("../../data/client.json")

async function recursiveUpdate(memberArray, server, msg, errors) {
  const nextMember = memberArray.pop()
  if (!nextMember) {
    let errorText = ""
    if (errors.length > 0) {
      errorText = `\nThere was an error while updating the following members: \`\`\`${errors.join(
        "\n",
      )}\`\`\``
    }
    return msg
      .reply(
        `<myMetroCOMMUNICATIONS:964132920732286998> MyMetro Verification has finished verifying the server, and ${server.bulkUpdateCount} members were affected.${errorText}`,
        { split: true },
      )
      .then(() => {
        server.bulkUpdateCount = 0
        server.ongoingBulkUpdate = false
      })
  }

  if (!nextMember.user.bot) {
    const member = await server.getMember(nextMember.id)
    if (member) {
      try {
        await member.verify({ skipWelcomeMessage: true })
      } catch (e) {
        errors.push(`${member.member.displayName}#${member.user.discriminator}`)
      }

      server.bulkUpdateCount++
    }
  }
  return recursiveUpdate(memberArray, server, msg, errors)
}

async function returnMembersOfRole(role) {
  return new Promise((resolve) => {
    role.guild.members.fetch().then((collection) => {
      let rolledMembers = collection.filter((member) =>
        member.roles.cache.has(role.id),
      )
      resolve(rolledMembers.array())
    })
  })
}

module.exports = class UpdateCommand extends Command {
  constructor(client) {
    super(client, {
      name: "update",
      properName: "Update",
      aliases: ["roverupdate"],
      description:
        "`<Discord User>` Forcibly update verification status of a user, same as them running !verify. Make sure you @mention the user.",
      throttling: { usages: 1, duration: 10 }, // 1 usage every 10 seconds

      args: [
        {
          key: "user",
          prompt: "User to update",
          type: "user|role",
          default: "",
        },
      ],
    })
  }

  hasPermission(msg) {
    const msgArgs = msg.parseArgs()
    return (
      this.client.isOwner(msg.author) ||
      msg.member.hasPermission(this.userPermissions) ||
      msg.member.roles.cache.find((role) => role.name === "Staff Team") ||
      !msgArgs ||
      msgArgs.match(new RegExp(`^<?@?!?${msg.author.id}>?$`))
    )
  }

  async fn(msg, args) {
    const target = args.user
    DiscordServer.clearMemberCache(target.id)

    const server = await this.discordBot.getServer(msg.guild.id)
    if (!target || !(target instanceof Role)) {
      // They want to update a specific user (not an instance of a Role), or no user was specified (self-update)
      const member = target
        ? await server.getMember(target.id)
        : await server.getMember(msg.author.id)
      if (!member) {
        return msg.reply("<myMetroCOMMUNICATIONS:964132920732286998> I couldn't find this user in the MyMetro server.")
      }

      member.verify({
        message: msg,
        skipWelcomeMessage: member.id !== msg.author.id,
      })
    } else {
      // They want to update a whole role (premium feature)
      const roleMembers = await returnMembersOfRole(target)
      const affectedCount = roleMembers.length // # of affected users
      const server = await this.discordBot.getServer(msg.guild.id)

      if (server.ongoingBulkUpdate) {
        return msg.reply(
          "<myMetroCOMMUNICATIONS:964132920732286998> MyMetro is currently updating members, please wait before trying to verify the server again.",
        )
      }

      server.ongoingBulkUpdate = true
      msg.reply(
        `<myMetroCOMMUNICATIONS:964132920732286998> MyMetro is now updating ${affectedCount} members.`,
      )

      recursiveUpdate(roleMembers, server, msg, [])
    }
  }
}
