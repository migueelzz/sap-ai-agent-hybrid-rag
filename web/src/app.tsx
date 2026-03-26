import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/pages/_layouts/app-layout'
import { HomePage } from '@/pages/home-page'
import { ChatsPage } from '@/pages/chats-page'
import { ChatPage } from '@/pages/chat-page'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="chats" element={<ChatsPage />} />
          <Route path="chat/:sessionId" element={<ChatPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
