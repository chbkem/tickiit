const logger = require("../lib/logger");
const customerTicketService = require("./customerTicketService");
const emailService = require("./emailService");
const { DEFAULT_ORG_NAME } = require("../constants/organization");

/**
 * sendFreshCustomerLink — issues one access token and emails its link.
 * A failure here never fails the ticket or comment that triggered it, so the
 * caller can keep its mutation and report success. A raw token is never logged.
 */
const sendFreshCustomerLink = async (
  { ticket, to, name, orgName = DEFAULT_ORG_NAME },
  {
    issue = customerTicketService.issueAccessToken,
    send = emailService.sendCustomerAccessLink,
    ...deps
  } = {},
) => {
  try {
    const access = await issue({ ticketId: ticket.id }, deps);
    const sent = await send({
      to,
      name,
      ticket,
      orgName,
      url: access.url,
    });
    return { sent, hashPrefix: access.hashPrefix };
  } catch (error) {
    logger.error("Failed to issue or send customer access link", {
      ticketId: ticket && ticket.id,
      ticketNumber: ticket && ticket.ticketNumber,
      errorMessage: error.message,
    });
    return { sent: false, hashPrefix: null };
  }
};

module.exports = { sendFreshCustomerLink };
