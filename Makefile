VERSION:=$(shell date +%y.%m.%d%H%M)

all:
	node build.js
	sed -i 's/^\(\s*"version"\s*:\s*"\)[0-9.]*\(.*\)$$/\1$(VERSION)\2/g' package.json

serve: all
	cd build; ../node_modules/http-server/bin/http-server

upload: all
	rsync --archive --update --progress --compress build/* www-data@baierouge.fr:/var/www/guillaume.baierouge.fr/