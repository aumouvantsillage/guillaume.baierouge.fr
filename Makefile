
VERSION:=$(shell date +%y.%m.%d%H%M)

FIGS_SRC:=$(wildcard figures/*/*)
FIGS_TMP:=$(addprefix tmp/,$(FIGS_SRC))

all: $(FIGS_TMP)
	node build.js
	sed -i 's/^\(\s*"version"\s*:\s*"\)[0-9.]*\(.*\)$$/\1$(VERSION)\2/g' package.json

serve: all
	./node_modules/.bin/ws -o -d build

upload: #all
	rsync --archive --checksum --delete --progress --compress build/* guillaume@baierouge.fr:/var/www/guillaume.baierouge.fr/

tmp/%.svg: %.svg
	@mkdir -p $(dir $@)
	inkscape --export-area-page --export-text-to-path --vacuum-defs --export-plain-svg=$@ $<

tmp/%.jpg: %.jpg
	@mkdir -p $(dir $@)
	cp $< $@

tmp/%.png: %.png
	@mkdir -p $(dir $@)
	cp $< $@
