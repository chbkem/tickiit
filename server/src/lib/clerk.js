const { createClerkClient } = require("@clerk/express");

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

module.exports = clerkClient;
