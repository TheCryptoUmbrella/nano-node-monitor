FROM node:12-alpine

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . /usr/src/app


ENV NODE_ENV=production
ENV REACT_APP_ENV=production
EXPOSE 80

CMD ["sh","-c","mkdir -p /opt/nanoMonitor && if [ ! -f /opt/nanoMonitor/env.production ]; then cp /usr/src/app/env.production /opt/nanoMonitor/env.production; fi && ln -sf /opt/nanoMonitor/env.production /usr/src/app/env.production && npm run build && node server/server.js"]
