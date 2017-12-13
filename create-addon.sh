#!/usr/bin/env bash

zip -FS -r live-reload.xpi * \
    -i "**/*" "LICENSE" "manifest.json" \
    -x "test/*" "node_modules/*"
