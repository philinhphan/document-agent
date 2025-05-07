import { NextResponse } from "next/server"
import { Request } from "node-fetch"

export async function GET(request: Request) {
    const key = process.env.OPENAI_API_KEY
    console.log(process.env.OPENAI_API_KEY)
    return NextResponse.json({
        key: key,
    })
}