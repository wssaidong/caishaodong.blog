#!/usr/bin/env just --justfile
export PATH := join(justfile_directory(), "node_modules", "bin") + ":" + env_var('PATH')

sever:
    zola serve

github:
    git push

new:
    hexo new [NAME]

build:
    zola build

publish:
    wrangler pages publish ./public

deploy:
    zola build
    wrangler pages publish ./public --project-name=caishaodong
