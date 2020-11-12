VERSION:=$(shell date +%y.%m.%d%H%M)

all:
	node build.js
	sed -i 's/^\(\s*"version"\s*:\s*"\)[0-9.]*\(.*\)$$/\1$(VERSION)\2/g' package.json

serve: all
	./node_modules/.bin/ws -o -d build

upload: #all
	rsync --archive --checksum --delete --progress --compress build/* guillaume@baierouge.fr:/var/www/guillaume.baierouge.fr/
