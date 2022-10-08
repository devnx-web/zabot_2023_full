import express from "express";
import multer from "multer";
import uploadConfig from "../config/upload";

import * as ApiController from "../controllers/ApiController";
import isAuthApi from "../middleware/isAuthApi";

const upload = multer(uploadConfig);

const ApiRoutes = express.Router();

ApiRoutes.post(
    "/mensagem/enviar",
    isAuthApi,
    upload.array("medias"),
    ApiController.sendMessage
);

ApiRoutes.post(
    "/contato/valida",
    isAuthApi,
    ApiController.validaContato
);
ApiRoutes.put(
    "/ticket/atualizar/:ticketId",
    isAuthApi,
    ApiController.atualizarTicket
);
ApiRoutes.get(
    "/whatsapps/buscar",
    isAuthApi,
    ApiController.buscaWhatsapps
);

//   Version in english:
ApiRoutes.get("/contact/search", isAuthApi, ApiController.buscaWhatsapps);
ApiRoutes.post("/contact/validation", isAuthApi, ApiController.validaContato);
ApiRoutes.post("/message/send", isAuthApi, upload.array("medias"), ApiController.sendMessage);
ApiRoutes.put("/ticket/update/:ticketId", isAuthApi, ApiController.atualizarTicket);

export default ApiRoutes;
