
import express, { NextFunction,Request,Response } from 'express';
require('dotenv').config();
export const app = express();
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorMiddleware } from './src/middleware/error';
import indexRouter from './src/routes/'
app.use(cookieParser());
app.use(express.json({limit:'50mb'}));
app.use(cors({
    origin:process.env.CORS_ORIGIN
}))

app.use('/api/v1',indexRouter)
app.get('/api',(req:Request,res:Response,next:NextFunction) => {
    res.status(200).json({success:true});
})

app.all("*", (req:Request, res:Response, next:NextFunction) => {
    const err = new Error(`Original url ${req.originalUrl} is not valid`)as any;
    err.statusCode=404;
    next(err);
})

app.use(errorMiddleware);