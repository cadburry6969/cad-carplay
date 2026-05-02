fx_version 'cerulean'
use_experimental_fxv2_oal 'yes'
game 'gta5'
lua54 'yes'

author 'Cadburry'
description 'Carplay System'
version '0.8'

shared_scripts {
  '@ox_lib/init.lua'
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'module/server.lua'
}

client_scripts {
  'module/client.lua'
}

ui_page 'web/index.html'
files {
  "web/*",
}

dependencies {
  'xsound',
}
