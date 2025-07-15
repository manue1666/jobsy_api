import express from "express"
import cors from "cors";


//servidor
const app = express()

app.use(cors());

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.get("/",(_req,res)=>{
    res.send("servidor js corriendo")
})

//enpoints




export default app