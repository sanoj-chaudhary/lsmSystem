require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/userModel";
import { CatchAsyncErrors } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import sendMail from "../utils/sendMail";
import path from "path";
import ejs from 'ejs';
import { sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { accessTokenOptions, refreshTokenOptions } from '../utils/jwt'
import { getUserById } from "../services/user.service";
import cloudinary from 'cloudinary';
interface IRegisterBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;
}

export const registrationUser = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body;
        const existUser = await userModel.findOne({ email })
        if (existUser) {
            return next(new ErrorHandler("Email already exists", 400))
        }

        const user: IRegisterBody = {
            name, email, password
        }
        const activationToken = createActivationToken(user)
        const activationCode = activationToken?.activationCode;
        const data = { user: { name: user.name }, activationCode }
        const html: string = await ejs.renderFile(path.join(__dirname, '../mails/activation-mail.ejs'), data);
        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                template: 'activation-mail.ejs',
                data
            })
            return res.status(201).json({ success: true, message: "Please activate your account.", activationToken: activationToken?.token })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})
interface IActivationToken {
    token: string;
    activationCode: string;
}
export const createActivationToken = (user: any): IActivationToken | undefined => {
    const activationCode = Math.floor(1000 * Math.random() * 9000).toString();
    const token = jwt.sign({ user, activationCode }, process.env.JWT_SECRET_KEY!, { expiresIn: "1d" });

    if (!token) {
        return undefined;
    }
    return { token, activationCode };
};

interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

export const activeUser = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activation_token, activation_code } = req.body as IActivationRequest;
        const newUser: { user: IUser; activationCode: string } = jwt.verify(
            activation_token,
            process.env.JWT_SECRET_KEY as string) as { user: IUser; activationCode: string };

        if (newUser.activationCode !== activation_code) {
            return next(new ErrorHandler("Invalid activation code", 400))
        }

        const { name, email, password } = newUser.user;
        const existUser = await userModel.findOne({ email })
        if (existUser) {
            return next(new ErrorHandler("User already exists", 400))
        }

        const user = await userModel.create({ name, email, password });
        res.status(200).json({ success: true })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

interface ILoginRequest {
    email: string;
    password: string;
}

export const loginUser = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as ILoginRequest;
        if (!email || !password) {
            return next(new ErrorHandler("Please enter email and password", 400));
        }
        const user = await userModel.findOne({ email }).select("password name email role");
        if (!user) {
            return next(new ErrorHandler("Please Invalid email or password", 400));
        }
        const isPasswordMatch = await user?.comparePasswords(password);
        if (!isPasswordMatch) {
            return next(new ErrorHandler("Please Invalid email or password", 400));
        }
        // req.user = user;
        sendToken(user, 200, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

export const logoutUser = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accessToken = req.cookies.access_token as string;
        res.clearCookie('access_token', { maxAge: 1 });
        res.clearCookie('refresh_token', { maxAge: 1 });
        const decode = jwt.verify(accessToken, process.env.ACCESSH_TOKEN_KEY as string) as JwtPayload;
        redis.del(decode.id)
        res.status(200).json({ success: true, message: "Logout user successfully" })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

export const updateAccessToken = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refresh_token = req.cookies.refresh_token as string;
        const decode = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_KEY as string) as JwtPayload;
        if (!decode) {
            return next(new ErrorHandler("Could not refresh token", 400))
        }

        const session = await redis.get(decode.id as string);
        if (!session) {
            return next(new ErrorHandler("Could not refresh token", 400))
        }
        const user = JSON.parse(session);
        const accessToken = jwt.sign({ id: user._id }, process.env.ACCESSH_TOKEN_KEY as string, {
            expiresIn: "5m"
        })
        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_KEY as string, {
            expiresIn: "5d"
        })
        // req.user = user
        res.cookie("access_token", accessToken, accessTokenOptions);
        res.cookie("refresh_token", refreshToken, refreshTokenOptions);
        res.status(200).json({ success: true, accessToken })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

export const getUserInfo = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accessToken = req.cookies.access_token as string;
        const decode = jwt.verify(accessToken, process.env.ACCESSH_TOKEN_KEY as string) as JwtPayload;
        const userId = decode.id

        getUserById(userId, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

interface ISocialAuthBody {
    email: string;
    name: string;
    avatar: string;
}

//social auth
export const socialAuth = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, name, avatar } = req.body as ISocialAuthBody;
        const user = await userModel.findOne({ email });
        if (!user) {
            const newUser = await userModel.create({
                email, name, avatar
            })
            sendToken(newUser, 200, res);
        } else {
            sendToken(user, 200, res);
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})


// update user info
interface IUpdateUserInfo {
    name: string;
    email: string;
    userId: string;
}

export const updateUserInfo = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, userId } = req.body as IUpdateUserInfo;
        const user = await userModel.findById(userId)
        if (!user) {
            return next(new ErrorHandler("User not found", 400));
        }
        if (user && email) {
            const isEmailExist = await userModel.findOne({ email });
            if (isEmailExist) {
                return next(new ErrorHandler("Email already exist in record", 400));
            }
            user.email = email;
        }

        if (name && email) {
            user.name = name;
        }

        await user?.save();
        await redis.set(userId, JSON.stringify(user))
        res.status(200).json({
            success: true,
            user
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
    userId: string;
}
export const updatePassword = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { oldPassword, newPassword, userId } = req.body as IUpdatePassword;
        if(!oldPassword || !newPassword){
            return next(new ErrorHandler("Please enter old password and new password", 400));
        }

        const user = await userModel.findById(userId).select('+password');

        if (!user || user.password === undefined) {
            return next(new ErrorHandler("Invalid user", 400));
        }

        const isPasswordMatch = await user.comparePasswords(oldPassword);

        if (!isPasswordMatch) {
            return next(new ErrorHandler("Please provide a valid old password", 400));
        }

        user.password = newPassword;
        await user.save();
        res.status(200).json({ success: true, user });

    } catch (error: any) {
        console.log(error)
        return next(new ErrorHandler(error.message, 400));
    }
});

interface IUpdatePicture {
    avatar: string;
    userId: string;
}

export const updateProfilePicture = CatchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {avatar,userId} = req.body as IUpdatePicture; 
      const user = await userModel.findById(userId)
      if(avatar && user) {
        if(user?.avtar?.public_id){
            await cloudinary.v2.uploader.destroy(user?.avtar?.public_id)
            const myCloud= await cloudinary.v2.uploader.upload(avatar,{
                folder:"avatars",
                width:150
            })

            user.avtar={
                public_id:myCloud.public_id,
                url:myCloud.secure_url
            }
        }else{
            const myCloud= await cloudinary.v2.uploader.upload(avatar,{
                folder:"avatars",
                width:150
            })
            user.avtar={
                public_id:myCloud.public_id,
                url:myCloud.secure_url
            }
        }
      }
      await user?.save();
      await redis.set(userId,JSON.stringify(user));
      res.status(200).json({
        success:true,
        message:"Profile updated successfully.",
        user
      })
    } catch (error: any) {
        console.log(error);
        return next(new ErrorHandler(error.message, 400));
    }
});

