const { getAuth } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const clerkClient = require("../lib/clerk");
const formService = require("../services/formService");
const { assertUserIsAdminInOrganization } = require("../services/clerkService");

const requireOrgAdmin = async (req) => {
  const { userId, orgId, orgRole } = getAuth(req);
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }
  if (!orgId) {
    throw new ApiError(400, "Select an organization to manage ticket forms.");
  }
  await assertUserIsAdminInOrganization({
    userId,
    orgId,
    sessionOrgId: orgId,
    sessionOrgRole: orgRole,
    message: "Only organization admins can manage ticket forms.",
  });
  return { userId, orgId };
};

const getOrganizationName = async (orgId) => {
  try {
    const organization = await clerkClient.organizations.getOrganization({
      organizationId: orgId,
    });
    return organization?.name ?? null;
  } catch (error) {
    logger.warn("Could not load organization name for form", {
      orgId,
      errorMessage: error.message,
    });
    return null;
  }
};

const publicBaseUrl = () => (process.env.APP_PUBLIC_URL || "").trim().replace(/\/+$/, "");

const serializeForm = (form) => {
  const base = publicBaseUrl();
  return {
    id: form.id,
    publicId: form.publicId,
    name: form.name,
    description: form.description,
    isActive: form.isActive,
    url: base ? `${base}/f/${form.publicId}` : null,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
  };
};

exports.listForms = asyncHandler(async (req, res) => {
  const { orgId } = await requireOrgAdmin(req);
  const forms = await formService.listFormsByOrg(orgId);
  res.json(forms.map(serializeForm));
});

exports.createForm = asyncHandler(async (req, res) => {
  const { userId, orgId } = await requireOrgAdmin(req);
  const { name, description } = req.body;

  const orgName = await getOrganizationName(orgId);
  const existingCount = name === undefined ? await formService.countFormsByOrg(orgId) : 0;
  const form = await formService.createForm({
    data: {
      name: name ?? `Support form #${existingCount + 1}`,
      description: description ?? null,
      orgId,
      orgName,
      createdBy: userId,
    },
  });

  logger.info("Ticket form created", {
    formId: form.id,
    orgId,
    actorId: userId,
  });

  res.status(201).json(serializeForm(form));
});

exports.updateForm = asyncHandler(async (req, res) => {
  const { orgId } = await requireOrgAdmin(req);
  const existing = await formService.findFormById(req.params.id);
  if (!existing || existing.orgId !== orgId) {
    throw new ApiError(404, "Form not found.");
  }

  const { name, description, isActive } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (isActive !== undefined) data.isActive = isActive;

  const form = await formService.updateForm(existing.id, data);

  logger.info("Ticket form updated", {
    formId: form.id,
    orgId,
    changes: Object.keys(data),
  });

  res.json(serializeForm(form));
});

exports.deleteForm = asyncHandler(async (req, res) => {
  const { orgId } = await requireOrgAdmin(req);
  const existing = await formService.findFormById(req.params.id);
  if (!existing || existing.orgId !== orgId) {
    throw new ApiError(404, "Form not found.");
  }

  await formService.deleteForm(existing.id);

  logger.info("Ticket form deleted", {
    formId: existing.id,
    orgId,
  });

  res.json({ message: "Form deleted successfully.", id: existing.id });
});
