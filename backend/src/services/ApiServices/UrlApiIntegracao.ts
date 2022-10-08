import WAWebJS, { Message as WbotMessage } from "whatsapp-web.js";
// import axios from "axios"
import { AxiosResponse } from "axios";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import api from "./Api";
import AppError from "../../errors/AppError";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const webhookApi = (
    url: string,
    obj: { ticket: Ticket; contact: Contact; mensagem: WAWebJS.Message }
) => {
    return api.post(url, obj);
};

const UrlApiIntegracao = async (
    contact: Contact,
    ticket: Ticket,
    mensagem: WbotMessage
): Promise<AxiosResponse> => {
    const enviaWebHook = { contact, ticket, mensagem };
    const settings = await Setting.findOne({
        where: { key: "urlApi" }
    });
    if (!settings) throw new AppError("ERR_URL_NAO_CONFIGURADA", 403);
    if (settings.value === "") {
        throw new AppError("ERR_URL_NAO_CONFIGURADA", 403);
    }
    return webhookApi(settings.value, enviaWebHook);
};

export default UrlApiIntegracao;
