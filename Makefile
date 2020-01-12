VERSION:=$(shell date +%y.%m.%d%H%M)

all:
	node build.js
	sed -i 's/^\(\s*"version"\s*:\s*"\)[0-9.]*\(.*\)$$/\1$(VERSION)\2/g' package.json

serve: all
	./node_modules/.bin/http-server -o index.html build

upload: #all
	rsync --archive --checksum --delete --progress --compress build/* www-data@baierouge.fr:/var/www/guillaume.baierouge.fr/
