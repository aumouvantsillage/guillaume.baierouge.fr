VERSION:=$(shell date +%y.%m.%d%H%M)

all:
	node build.js
	sed -i 's/^\(\s*"version"\s*:\s*"\)[0-9.]*\(.*\)$$/\1$(VERSION)\2/g' package.json

serve:
	cd build; ../node_modules/http-server/bin/http-server