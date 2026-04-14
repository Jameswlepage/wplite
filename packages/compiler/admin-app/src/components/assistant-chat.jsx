import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Add } from '@carbon/icons-react';

const MOCK_REPLIES = [
  "I can help refactor this page, rewrite blocks, or move content into a different model. Ask for a concrete edit and I'll treat the current canvas as the source of truth.",
  'This shell keeps the active entity loaded while content, media, and settings open in overlays. The editor beneath does not unmount when those overlays open.',
  'Search can switch the current page, post, or collection entry directly. The content popover exposes the same entities as browsable lists when you need a broader sweep.',
  'The current preview shell is coming from the route manifest and theme template data. Saving here updates the content slot while preserving the template wrapper.',
];

function pickMockReply(input) {
  const seed = input.split('').reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 1000, 0);
  return MOCK_REPLIES[seed % MOCK_REPLIES.length];
}

export function AssistantChat() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const streamTimer = useRef(null);

  useEffect(() => () => {
    if (streamTimer.current) {
      clearInterval(streamTimer.current);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function autogrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  function streamReply(target, full) {
    let index = 0;
    const id = target.id;

    streamTimer.current = setInterval(() => {
      index += Math.max(1, Math.floor(Math.random() * 4));
      const next = full.slice(0, index);
      setMessages((current) => current.map((message) => (
        message.id === id ? { ...message, text: next } : message
      )));

      if (index >= full.length) {
        clearInterval(streamTimer.current);
        streamTimer.current = null;
        setIsStreaming(false);
      }
    }, 20);
  }

  function send() {
    const text = draft.trim();
    if (!text || isStreaming) return;

    const user = { id: `u-${Date.now()}`, role: 'user', text };
    const assistant = { id: `a-${Date.now()}`, role: 'assistant', text: '' };

    setMessages((current) => [...current, user, assistant]);
    setDraft('');
    setIsStreaming(true);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    });

    streamReply(assistant, pickMockReply(text));
  }

  function onComposerClick(event) {
    if (event.target.closest('.workspace-chat__send')) return;
    textareaRef.current?.focus();
  }

  const canSend = draft.trim().length > 0 && !isStreaming;

  return (
    <div className="workspace-chat">
      <div className="workspace-chat__intro">
        <div className="workspace-chat__eyebrow">AI</div>
        <h2>Copilot</h2>
        <p>
          Ask for edits, explain the current page, or jump to another entity without losing the canvas.
        </p>
      </div>

      <div className="workspace-chat__thread" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="workspace-chat__empty">
            <div className="workspace-chat__empty-mark">
              <Add size={18} />
            </div>
            <div>
              <strong>Persistent alongside the editor</strong>
              <p>The underlying content stays mounted while you browse content, media, and settings.</p>
            </div>
          </div>
        ) : (
          <ol className="workspace-chat__messages" aria-live="polite">
            {messages.map((message) => (
              <li key={message.id} className={`workspace-chat__message workspace-chat__message--${message.role}`}>
                <div className="workspace-chat__bubble">
                  {message.text}
                  {message.role === 'assistant' && isStreaming && message === messages[messages.length - 1] ? (
                    <span className="workspace-chat__caret" aria-hidden="true" />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div
        className="workspace-chat__composer"
        role="group"
        aria-label="AI assistant composer"
        onClick={onComposerClick}
      >
        <textarea
          ref={textareaRef}
          className="workspace-chat__input"
          placeholder="Ask anything..."
          rows={1}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            autogrow();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          className="workspace-chat__send"
          aria-label="Send message"
          disabled={!canSend}
          onClick={send}
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}
