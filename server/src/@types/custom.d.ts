import { Request } from "express";
import { IUser } from "../src/models/userModel";

declare global {
    namespace express{
        interface Request{
            user?: IUser;
        }
    }
}