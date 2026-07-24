import { onRequestPost as __api_login_js_onRequestPost } from "D:\\Code\\CableWeb153\\functions\\api\\login.js"
import { onRequest as __api_articles_js_onRequest } from "D:\\Code\\CableWeb153\\functions\\api\\articles.js"

export const routes = [
    {
      routePath: "/api/login",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_login_js_onRequestPost],
    },
  {
      routePath: "/api/articles",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_articles_js_onRequest],
    },
  ]