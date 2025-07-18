import mongoose from "mongoose";
import app from "./app.js";
import dotenv from "dotenv";

dotenv.config()

async function main() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Aplicacion conectada a la base de datos")
        app.listen(4000,()=>{
            console.log("Aplicacion corriendo")
            //este solo es un log del el localhost
            console.log("http://127.0.0.1:4000")
        })
    } catch (error) {
        console.log("hubo un error en la base de datos")
    }
}


main()