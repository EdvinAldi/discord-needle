import { type ClientEvents, NewsChannel, TextChannel } from "discord.js";
import { removeUserReactionsOnMessage } from "../helpers/djsHelpers.js";
import ListenerRunType from "../models/enums/ListenerRunType.js";
import MessageVariables from "../models/MessageVariables.js";
import NeedleEventListener from "../models/NeedleEventListener.js";
import type NeedleBot from "../NeedleBot.js";
import ObjectFactory from "../ObjectFactory.js";
import type ThreadCreationService from "../services/ThreadCreationService.js";

export default class MessageCreateEventListener extends NeedleEventListener {
	public readonly name = "messageCreate";
	public readonly runType = ListenerRunType.EveryTime;

	private readonly threadCreator: ThreadCreationService;

	constructor(bot: NeedleBot) {
		super(bot);
		this.threadCreator = ObjectFactory.createThreadCreationService();
	}

	public async handle([message]: ClientEvents["messageCreate"]): Promise<void> {
		const messageShouldHaveThread = await this.threadCreator.shouldHaveThread(message);
		if (!messageShouldHaveThread) return;
		if (!message.inGuild()) return;

		const botMember = await message.guild.members.fetchMe();
		const guildConfig = this.bot.configs.get(message.guildId);
		const channelConfig = guildConfig.threadChannels?.find(
			c => c.channelId === message.channelId || c.channelId === message.channel.parentId
		);

		if (!channelConfig) return;
		if (
			message.channel.isThread() &&
			!message.author.bot &&
			channelConfig.statusReactions &&
			channelConfig.archiveImmediately
		) {
			const startMessage = await message.channel.fetchStarterMessage();
			if (!startMessage) return;
			if (startMessage.author.id === message.author.id) return;
			await removeUserReactionsOnMessage(startMessage, botMember.id);
		}
		if (!(message.channel instanceof TextChannel) && !(message.channel instanceof NewsChannel)) return;

		const { author, member, channel } = message;
		const messageVariables = new MessageVariables().setChannel(channel).setUser(member ?? author);

		await this.threadCreator.createThreadOnMessage(message, messageVariables);
	}
}
