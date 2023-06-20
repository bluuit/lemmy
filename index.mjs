import { LemmyWebsocket } from 'lemmy-js-client'
import { WebSocket } from 'ws'

const ws = new WebSocket('ws://localhost:1236');

const lemmy = new LemmyWebsocket()

const form = {
    username_or_email: 'bluuit',
    password: 'lemmylemmy'
}

ws.send(lemmy.login(form))
