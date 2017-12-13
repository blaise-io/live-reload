#!/usr/bin/env bash

rm -f live-reload.xpi
zip -r live-reload.xpi * -x "test/*" "*/.*" "*.xpi" "*.sh"  "node_modules/*" "*.md"
