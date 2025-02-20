#!/usr/bin/env just --justfile
export PATH := join(justfile_directory(), "node_modules", "bin") + ":" + env_var('PATH')

sever:
    hexo server

github:
    git push

new:
    hexo new [NAME]

generate:
    hexo generate

publish:
    wrangler pages publish ./public

deploy:
    zola build
    wrangler pages publish ./public
