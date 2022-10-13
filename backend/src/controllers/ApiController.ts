import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import Ticket from "../models/Ticket";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import formatBody from "../helpers/Mustache";
import CloseTicketService from "../services/TicketServices/CloseTicketService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";

type MessageData = {
  body: string;
  name: string;
  fromMe: boolean;
  read: boolean;
  idRobo: number;
  quotedMsg?: Message;
};

interface ContactData {
  number: string;
}

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
}
const createContact = async (
  idRobo: number,
  newContact: string,
  name: string
) => {
  await CheckIsValidContact(newContact);

  const validNumber: any = await CheckContactNumber(newContact);

  const profilePicUrl = await GetProfilePicUrl(validNumber);

  const number = validNumber;
  if (!name || name.length < 1) name = number;
  const contactData = {
    name: `${name}`,
    number,
    profilePicUrl,
    isGroup: false
  };

  const contact = await CreateOrUpdateContactService(contactData);

  const createTicket = await FindOrCreateTicketService(contact, idRobo, 1);

  const ticket = await ShowTicketService(createTicket.id);

  SetTicketMessagesAsRead(ticket);

  return ticket;
};

export const buscaWhatsapps = async (req: Request, res: Response) => {
  const whatsapps = await ListWhatsAppsService();
  return res.status(200).json(whatsapps);
}

export const validaContato = async (req: Request, res: Response) => {
  const { numero } = req.body;
  await CheckIsValidContact(numero);
  const validNumber: any = await CheckContactNumber(numero);
  const profilePicUrl = await GetProfilePicUrl(validNumber);
  const dadosContato = {
    success: true,
    profilePicUrl
  };
  return res.status(200).json(dadosContato);
}


export const sendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const newContact: ContactData = req.body;
  const { body, quotedMsg, name }: MessageData = req.body;
  let { idRobo }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  if (!newContact.number) {
    throw new AppError("ERR_NUMERO_INVALIDO");
  }
  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (!idRobo) {
    const defaultWhatsapp = await GetDefaultWhatsApp();
    idRobo = defaultWhatsapp.id;
  }

  const contactAndTicket = await createContact(idRobo, newContact.number, name);
  const { id: ticketId } = contactAndTicket;
  if (medias) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        await SendWhatsAppMedia({
          body,
          media,
          ticket: contactAndTicket
        });
      })
    );
  } else {
    await SendWhatsAppMessage({ body, ticket: contactAndTicket, quotedMsg });
  }
  await CloseTicketService(ticketId);
  return res.status(200).json(contactAndTicket);
};

export const atualizarTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const bticket = await Ticket.findByPk(ticketId);
  if (!bticket) {
    throw new AppError("ERR_TICKET_NOT_FOUND", 403);
  }
  const { ticket } = await UpdateTicketService({
    ticketData,
    ticketId
  });

  if (ticket.status === "closed") {
    const whatsapp = await ShowWhatsAppService(ticket.whatsappId);
    const { farewellMessage } = whatsapp;
    if (farewellMessage) {
      await SendWhatsAppMessage({
        body: formatBody(farewellMessage, ticket.contact),
        ticket
      });
    }
  }

  // return res.status(200).json(ticket);
  return res.status(200).json("ticket");
};
