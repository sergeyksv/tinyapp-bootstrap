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
cp templates/$DEFAULT_TEMPLATE/.gitignore $PROJECT_PATH/
cp templates/$DEFAULT_TEMPLATE/.eslintrc $PROJECT_PATH/

cd $PROJECT_PATH

git init

sed -i "s/__NAME__/$NAME/g" package.json
sed -i "s/__NAME__/$NAME/g" config.js
sed -i "s/__NAME__/$NAME/g" README.md
PASS=$(date +%s | sha256sum | base64 | head -c 16)
sed -i "s/__PASSWORD__/$PASS/g" dataentry/users.json

CFG_SALT=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
sed -i "s/__SALT__/$CFG_SALT/g" config.js

CFG_MASTERPASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
sed -i "s/__MASTERPASS__/$CFG_MASTERPASS/g" config.js

git add *
git add .gitignore
git add .eslintrc
git commit -m "initial commit"
git subtree add --prefix modules/tinyback git@git.pushok.com:pushok/tinyback.git json_params --squash
git subtree add --prefix modules/tinybone git@git.pushok.com:pushok/tinybone.git json_params --squash
npm i
