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
import GetTicketWbot from "../helpers/GetTicketWbot";
import { Buttons, List } from "whatsapp-web.js";

type MessageData = {
  body: string;
  name: string;
  fromMe: boolean;
  read: boolean;
  botId: number;
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
  botId: number,
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

  const createTicket = await FindOrCreateTicketService(contact, botId, 1);

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
  let { botId }: MessageData = req.body;
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

  if (!botId) {
    const defaultWhatsapp = await GetDefaultWhatsApp();
    botId = defaultWhatsapp.id;
  }

  const contactAndTicket = await createContact(botId, newContact.number, name);
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


export const sendButton = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const newContact: ContactData = req.body;
  const { body, quotedMsg, name }: MessageData = req.body;
  let { botId }: MessageData = req.body;
  if (!newContact.number) {
    throw new AppError("ERR_NUMERO_INVALIDO");
  }
  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  if (!botId) {
    const defaultWhatsapp = await GetDefaultWhatsApp();
    botId = defaultWhatsapp.id;
  }

  const contactAndTicket = await createContact(botId, newContact.number, name);

  const wbot = await GetTicketWbot(contactAndTicket);

  const TEST_JID = `${newContact.number}@c.us`; // modify
  const buttons_reply = new Buttons('test', [{ body: 'Test', id: 'test-1' }], 'title', 'footer') // Reply button

  const buttons_reply_url = new Buttons('test', [{ body: 'Test', id: 'test-1' }], 'title', 'footer') // Reply button with URL

  const buttons_reply_call = new Buttons('test', [{ body: 'Test', id: 'test-1' }], 'title', 'footer') // Reply button with call button

  const buttons_reply_call_url = new Buttons('test', [{ body: 'Test', id: 'test-1' }, { body: 'Test 3 URL', id: 'test-3' }], 'title', 'footer') // Reply button with call button & url button

  const section = {
    title: 'test',
    rows: [
      {
        title: 'Test 1',
      },
      {
        title: 'Test 2',
        id: 'test-2'
      },
      {
        title: 'Test 3',
        description: 'This is a smaller text field, a description'
      },
      {
        title: 'Test 4',
        description: 'This is a smaller text field, a description',
        id: 'test-4',
      }
    ],
  };

  // send to test_jid
  for (const component of [buttons_reply, buttons_reply_url, buttons_reply_call, buttons_reply_call_url]) await wbot.sendMessage(TEST_JID, component);

  const list = new List('test', 'click me', [section], 'title', 'footer')
  await wbot.sendMessage(TEST_JID, list);
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
