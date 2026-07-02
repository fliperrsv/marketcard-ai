import { NextResponse } from 'next/server';
import GigaChat from 'gigachat';
import { Agent } from 'node:https';

const httpsAgent = new Agent({ rejectUnauthorized: false });

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    const client = new GigaChat({
      credentials: process.env.GIGACHAT_CREDENTIALS,
      scope: 'GIGACHAT_API_PERS',
      httpsAgent: httpsAgent,
      model: 'GigaChat-2-Pro',
    });

    const response = await client.chat({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    return NextResponse.json({ success: true, data: content });
  } catch (error) {
    console.error('GigaChat error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка генерации' },
      { status: 500 }
    );
  }
}
