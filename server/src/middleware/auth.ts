import { Request,Response,NextFunction } from "express";
import { CatchAsyncErrors } from "./catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import jwt,{JwtPayload} from "jsonwebtoken";
import { redis } from "../utils/redis";

export const isAuthenticated = CatchAsyncErrors(async (req:Request,res:Response,next:NextFunction) => {
    const accessToken = req.cookies.access_token as string;
    if(!accessToken){
        return next(new ErrorHandler("Please Login to access this resource",400));
    }
    const decode = jwt.verify(accessToken,process.env.ACCESSH_TOKEN_KEY as string) as JwtPayload;
    if(!decode){
        return next(new ErrorHandler("Unauthrized access",400));
    }
    const user = await redis.get(decode.id)
    if(!user){
        return next(new ErrorHandler("User not found",400));
    }
    next();
});

export const authrizedRoles =  (...roles: string[])=>{
    return async (req:Request,res:Response,next:NextFunction)=>{
        const accessToken = req.cookies.access_token as string;
        const decode = jwt.verify(accessToken,process.env.ACCESSH_TOKEN_KEY as string) as JwtPayload;
        const user = await redis.get(decode.id)
        let role: string = '';
        role = JSON.parse(user || '').role;
        if(!roles.includes(role || '')){
            return next(new ErrorHandler(`Role: ${role} is not allow to access this resource`,403));
        }
        next();
    }
}