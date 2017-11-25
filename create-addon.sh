#!/usr/bin/env bash

zip -r live-reload.xpi * -x "test/*" "*/.*" "*.xpi" "*.sh" "*.md"
