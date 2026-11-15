const crypto = require("crypto");
const prisma = require("../lib/prisma");

const PUBLIC_ID_BYTES = 18;
const CREATE_ATTEMPTS = 3;

const generatePublicId = () => crypto.randomBytes(PUBLIC_ID_BYTES).toString("base64url");

const listFormsByOrg = (orgId) =>
  prisma.ticketForm.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

const countFormsByOrg = (orgId) => prisma.ticketForm.count({ where: { orgId } });

const findFormById = (id) => prisma.ticketForm.findUnique({ where: { id } });

const findActiveFormByPublicId = (publicId) =>
  prisma.ticketForm.findFirst({ where: { publicId, isActive: true } });

/**
 * createForm — allocates an opaque public id. Collisions are vanishingly
 * unlikely, but a unique-constraint failure is retried a few times rather than
 * surfacing a 500 to the caller.
 */
const createForm = async ({ data }) => {
  for (let attempt = 1; attempt <= CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.ticketForm.create({
        data: { ...data, publicId: generatePublicId() },
      });
    } catch (error) {
      if (error?.code !== "P2002" || attempt === CREATE_ATTEMPTS) throw error;
    }
  }
  return null;
};

const updateForm = (id, data) =>
  prisma.ticketForm.update({ where: { id }, data });

const deleteForm = (id) => prisma.ticketForm.delete({ where: { id } });

module.exports = {
  generatePublicId,
  listFormsByOrg,
  countFormsByOrg,
  findFormById,
  findActiveFormByPublicId,
  createForm,
  updateForm,
  deleteForm,
};
