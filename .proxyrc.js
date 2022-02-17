const serveStatic = require('serve-static')
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    // Use static middleware
    app.use(serveStatic('static'))

    // Proxy to web4
    app.use(
        createProxyMiddleware("/web4", {
            target: "http://localhost:3000/"
        })
    );
}
