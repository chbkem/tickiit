const { getAuth } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const channelService = require("../services/channelService");
const { assertUserIsAdminInOrganization } = require("../services/clerkService");

exports.listChannels = asyncHandler(async (req, res) => {
  const { orgId, userId, orgRole } = getAuth(req);
  if (!orgId) {
    throw new ApiError(403, "You must be in an organization to manage channels.");
  }
  await assertUserIsAdminInOrganization({ userId, orgId, sessionOrgId: orgId, sessionOrgRole: orgRole });

  const channels = await channelService.listChannels(orgId);
  res.json(channels);
});

exports.createChannel = asyncHandler(async (req, res) => {
  const { orgId, userId, orgRole } = getAuth(req);
  if (!orgId) {
    throw new ApiError(403, "You must be in an organization to manage channels.");
  }
  await assertUserIsAdminInOrganization({ userId, orgId, sessionOrgId: orgId, sessionOrgRole: orgRole });

  const { channel, identifier } = req.body;
  const existing = await channelService.findChannelByIdentifier(channel, identifier);
  if (existing) {
    throw new ApiError(409, "A channel with this identifier already exists.");
  }

  const created = await channelService.createChannel({ orgId, channel, identifier });
  res.status(201).json(created);
});

exports.updateChannel = asyncHandler(async (req, res) => {
  const { orgId, userId, orgRole } = getAuth(req);
  if (!orgId) {
    throw new ApiError(403, "You must be in an organization to manage channels.");
  }
  await assertUserIsAdminInOrganization({ userId, orgId, sessionOrgId: orgId, sessionOrgRole: orgRole });

  const channel = await channelService.findChannelById(req.params.id);
  if (!channel) {
    throw new ApiError(404, "Channel not found.");
  }

  const updated = await channelService.updateChannel(req.params.id, req.body);
  res.json(updated);
});

exports.deleteChannel = asyncHandler(async (req, res) => {
  const { orgId, userId, orgRole } = getAuth(req);
  if (!orgId) {
    throw new ApiError(403, "You must be in an organization to manage channels.");
  }
  await assertUserIsAdminInOrganization({ userId, orgId, sessionOrgId: orgId, sessionOrgRole: orgRole });

  const channel = await channelService.findChannelById(req.params.id);
  if (!channel) {
    throw new ApiError(404, "Channel not found.");
  }

  await channelService.deleteChannel(req.params.id);
  res.status(204).send();
});
