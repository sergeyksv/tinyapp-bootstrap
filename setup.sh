#!/bin/bash
#USAGE
#./setup.sh demo ~/work
NAME=$1
if [ -z $NAME ]; then
	echo "Please specify name of instance in first parameter"
	exit
fi

DIR_PATH=$2
if [ -z $DIR_PATH ]; then
	echo "Please specify directory to locate project"
	exit
fi

PROJECT_PATH=$DIR_PATH/$NAME
if [ -d $PROJECT_PATH ]; then
	echo "Project folder already exists"
	exit
fi

mkdir $PROJECT_PATH

DEFAULT_TEMPLATE="web_with_auth"

cp -r templates/$DEFAULT_TEMPLATE/* $PROJECT_PATH/
cp templates/$DEFAULT_TEMPLATE/.gitignore $PROJECT_PATH/.gitignore

cd $PROJECT_PATH

git init
git submodule add http://git.pushok.com/pushok/tinyback.git modules/tinyback
git submodule add http://git.pushok.com/pushok/tinybone.git modules/tinybone
git submodule update

sed -i "s/__NAME__/$NAME/g" package.json
sed -i "s/__NAME__/$NAME/g" config.js
sed -i "s/__NAME__/$NAME/g" README.md

CFG_SALT=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
sed -i "s/__SALT__/$CFG_SALT/g" config.js

CFG_MASTERPASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
sed -i "s/__MASTERPASS__/$CFG_MASTERPASS/g" config.js

npm i
