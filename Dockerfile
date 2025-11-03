FROM nginx:alpine

# Serve the static site from Nginx's default html directory
WORKDIR /usr/share/nginx/html

# Copy repository contents into the container
COPY . .

# Point the client fetch to the local TSV copy bundled in the image
RUN sed -i "s|https://api.github.com/repos/renniepak/CSPBypass/contents/data.tsv?ref=main|data.tsv|g" script.js
RUN sed -i "s|https://api.github.com/repos/renniepak/CSPBypass/contents/credits.txt?ref=main|credits.txt|g" script.js
RUN sed -i "s|https://cspbypass.com/cspbypass.png|cspbypass.png|g" index.html

EXPOSE 80

# Run Nginx in the foreground so the container keeps running
CMD ["nginx", "-g", "daemon off;"]
