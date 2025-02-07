#!/usr/bin/env just --justfile
export PATH := join(justfile_directory(), "node_modules", "bin") + ":" + env_var('PATH')

sever:
    hexo server

generate:
    hexo generate

publish:
    wrangler pages publish ./public
