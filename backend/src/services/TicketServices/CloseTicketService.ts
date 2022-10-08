import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

interface Response {
  ticket: Ticket;
}

function sleep(ms: number | undefined) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CloseTicketService = async (
  ticketId: string | number
): Promise<Response> => {
  await sleep(2000);
  const ticket = await ShowTicketService(ticketId);
  await SetTicketMessagesAsRead(ticket);
  await ticket.update({ status: "closed", queueId: null, userId: null });

  return { ticket };
};

export default CloseTicketService;
