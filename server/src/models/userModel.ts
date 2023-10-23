import  jwt from 'jsonwebtoken';
import mongoose, { Document, Model, Schema } from "mongoose";
import bcryptjs from "bcryptjs";
const emailRegex: RegExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    avtar: {
        public_id: string;
        url: string;
    },
    role: string;
    isVerified: boolean;
    courses: Array<{ course_id: string }>;
    comparePasswords: (password: string) => Promise<boolean>;
    SignAccessToken: ()=>string;
    SignRefreshToken: ()=>string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name."],
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        validate: {
            validator: function (value: string) {
                return emailRegex.test(value);
            },
            message: "Please enter a valid email address"
        },
        unique: true
    },
    password: {
        type: String,
        // minLength: [6, "Password must be at least 6 characters"],
        select: false,
    },
    avtar: {
        public_id: String,
        url: String,
    },
    role: {
        type: String,
        default: "user",

    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    courses: [
        {
            courseId: String,
        }
    ],

}, {
    timestamps: true,
});
userSchema.pre<IUser>('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    this.password = await bcryptjs.hash(this.password, 10);
    next();
});

userSchema.methods.SignAccessToken = function(){
    return jwt.sign({id:this._id}, process.env.ACCESSH_TOKEN_KEY || '',{
        expiresIn:"5m"
    });
}
userSchema.methods.SignRefreshToken = function(){
    return jwt.sign({id:this._id}, process.env.REFRESH_TOKEN_KEY || '',{
        expiresIn:'3d'
    });
}

userSchema.methods.comparePasswords = async function (enteredPassword: string): Promise<boolean> {
    try {
        return await bcryptjs.compare(enteredPassword, this.password);
    } catch (err:any) {
        throw err;
    }
};
const userModel = mongoose.model<IUser>('User', userSchema);
// Create and export the User model
export default userModel;