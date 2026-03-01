'use client';

interface Props {
  role: 'user' | 'agent';
  content: string;
  streaming?: boolean;
}

export function ImagineChatBubble({ role, content, streaming }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[70%] px-4 py-3 rounded-2xl text-sm text-white leading-relaxed"
          style={{
            background: 'linear-gradient(135deg, #89b4fa 0%, #6a9af5 100%)',
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-4 py-3 rounded-xl text-sm text-[#cdd6f4] bg-[#313244] leading-relaxed whitespace-pre-wrap">
        {content}
        {streaming && (
          <span className="inline-block w-0.5 h-4 ml-0.5 bg-[#89b4fa] animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
