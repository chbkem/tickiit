const prisma = require("../lib/prisma");

const listChannels = (orgId) =>
  prisma.channel.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

const findChannelById = (id) => prisma.channel.findUnique({ where: { id } });

const findChannelByIdentifier = (channel, identifier) =>
  prisma.channel.findFirst({
    where: { channel, identifier, isActive: true },
  });

const createChannel = ({ orgId, channel, identifier }) =>
  prisma.channel.create({
    data: { orgId, channel, identifier },
  });

const updateChannel = (id, data) =>
  prisma.channel.update({
    where: { id },
    data,
  });

const deleteChannel = (id) => prisma.channel.delete({ where: { id } });

module.exports = {
  listChannels,
  findChannelById,
  findChannelByIdentifier,
  createChannel,
  updateChannel,
  deleteChannel,
};
