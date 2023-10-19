import {app} from './app';
import connectDb from './src/utils/db';
require('dotenv').config();

app.listen(process.env.PORT,()=>{
    console.log(`listening on ${process.env.PORT}`);
    connectDb();
})