local spawnedSounds = {}
local isUiOpen = false
local currentVeh = nil

local function notify(msg, type, title, time)
    lib.notify({ title = title, description = msg, type = type, duration = time })
end

local function getPeds(veh)
    local peds = {}
    for i = -1, (GetVehicleMaxNumberOfPassengers(veh) - 1), 1 do
        local ped = GetPedInVehicleSeat(veh, i)
        if ped ~= 0 then
            table.insert(peds, GetPlayerServerId(NetworkGetPlayerIndexFromPed(ped)))
        end
    end
    return peds
end

local function carPlay()
    if not cache.vehicle then
        notify("You are not in a vehicle", "error", "Error", 5000)
        return
    end
    currentVeh = cache.vehicle
    isUiOpen = true
    SendNUIMessage({
        event = "openCarPlay",
        veh = VehToNet(currentVeh),
        vehIdStr = tostring(VehToNet(currentVeh)),
        queue = Entity(currentVeh).state.carplay_queue
    })
    SetNuiFocus(true, true)
end

local function startPlaybackLoop(veh, vehStr)
    CreateThread(function()
        while true do
            Wait(1000)

            if not exports.xsound:soundExists("carplay_" .. vehStr) then
                break
            end

            local totalDurr = exports.xsound:getMaxDuration("carplay_" .. vehStr)
            local currTime = exports.xsound:getTimeStamp("carplay_" .. vehStr)

            if Entity(veh).state then
                Entity(veh).state:set('carplay_currTime', currTime, true)
            end

            if totalDurr > 0 and currTime + 1 >= totalDurr then
                TriggerEvent("cad-carplay:playsound", { event = "nextSong", veh = VehToNet(veh), vehStr = vehStr })
                break
            end

            if isUiOpen and currentVeh == veh then
                SendNUIMessage({
                    event = "updateTime",
                    time = { currentTime = currTime, totalDuration = totalDurr }
                })
            end

            if GetVehiclePedIsIn(PlayerPedId(), false) ~= veh then
                SendNUIMessage({ event = "resetPlayback" })
                exports.xsound:Destroy("carplay_" .. vehStr)
                break
            end
        end

        if isUiOpen and currentVeh == veh then
            SendNUIMessage({
                event = "updateTime",
                time = { currentTime = 0, totalDuration = 0 }
            })
        end
    end)
end

local function vehicleEntered(veh)
    local state = Entity(veh).state
    if state and state.carplay_queue then
        local currQueue = state.carplay_queue
        local queuePos = state.carplay_queuePos or 1
        local data = currQueue[queuePos]
        local currTime = state.carplay_currTime or 0

        if data ~= nil then
            local vehStr = tostring(VehToNet(veh))
            if exports.xsound:soundExists("carplay_" .. vehStr) then
                exports.xsound:Destroy("carplay_" .. vehStr)
            end

            local volume = state.carplay_volume or 1.0

            exports.xsound:PlayUrl("carplay_" .. vehStr, data.link, volume, false, {
                onPlayStart = function(event)
                    table.insert(spawnedSounds, veh)
                    SendNUIMessage({
                        event = "playbackStarted",
                        link = data.link,
                        vol = volume
                    })

                    exports.xsound:setTimeStamp("carplay_" .. vehStr, math.floor(currTime))
                    if state.carplay_isPaused then
                        exports.xsound:Pause("carplay_" .. vehStr)
                        SendNUIMessage({ event = "setPicPaused" })
                    end

                    startPlaybackLoop(veh, vehStr)
                end
            })
        end
    end
end

RegisterNUICallback('closeCarPlay', function(cd)
    isUiOpen = false
    SetNuiFocus(false, false)
end)

RegisterNUICallback('requestPlaylists', function(data, cb)
    local playlists, songs = lib.callback.await('cad-carplay:requestPlaylistsAndSongs', false)
    SendNUIMessage({
        event = "getPlaylists",
        playlists = playlists,
        songs = songs
    })
    cb('ok')
end)

RegisterNUICallback('importPlaylist', function(data, cb)
    local success = lib.callback.await('cad-carplay:importPlaylist', false, data.code)
    cb(success)
end)

RegisterNUICallback('createPlaylist', function(data, cb)
    local success = lib.callback.await('cad-carplay:createPlaylist', false, data.label, data.firstSong or '')
    cb(success)
end)

RegisterNUICallback('playPlaylist', function(data, cb)
    TriggerServerEvent('cad-carplay:playPlaylist', data.id, data.veh, data.vehStr)
    cb('ok')
end)

RegisterNUICallback('addSongToPlaylist', function(data, cb)
    local success = lib.callback.await('cad-carplay:addSongToPlaylist', false, data.playlistId, data.link)
    cb(success and 'ok' or 'error')
end)

RegisterNetEvent('cad-carplay:playsound', function(data)
    local veh = NetToVeh(data.veh)
    if not DoesEntityExist(veh) then return end
    local vehStr = data.vehStr
    local state = Entity(veh).state

    if data.event == "url" then
        if data.shouldForce then
            if exports.xsound:soundExists("carplay_" .. vehStr) then
                exports.xsound:Destroy("carplay_" .. vehStr)
            end
            Wait(100)
        end

        if not data.shouldForce and exports.xsound:soundExists("carplay_" .. vehStr) then
            local currQueue = state.carplay_queue or {}
            data.queuePos = #currQueue + 1
            table.insert(currQueue, data)
            state:set('carplay_queue', currQueue, true)
        else
            if data.queuePos then
                state:set('carplay_queuePos', data.queuePos, true)
            end

            if state.carplay_queue == nil then
                local queue = {}
                data.queuePos = data.queuePos or 1
                table.insert(queue, data)
                state:set('carplay_queue', queue, true)
            end

            if exports.xsound:soundExists("carplay_" .. vehStr) then
                exports.xsound:Destroy("carplay_" .. vehStr)
            end

            local volume = state.carplay_volume or 1.0

            exports.xsound:PlayUrl("carplay_" .. vehStr, data.link, volume, false, {
                onPlayStart = function(event)
                    table.insert(spawnedSounds, veh)
                    SendNUIMessage({
                        event = "playbackStarted",
                        link = data.link,
                        vol = volume
                    })
                    startPlaybackLoop(veh, vehStr)
                end
            })
        end
    elseif data.event == "resume" then
        if exports.xsound:soundExists("carplay_" .. vehStr) then
            exports.xsound:Resume("carplay_" .. vehStr)
            state:set('carplay_isPaused', false, true)
        end
    elseif data.event == "pause" then
        if exports.xsound:soundExists("carplay_" .. vehStr) then
            exports.xsound:Pause("carplay_" .. vehStr)
            state:set('carplay_isPaused', true, true)
        end
    elseif data.event == "resetPlayback" then
        exports.xsound:Destroy("carplay_" .. vehStr)
    elseif data.event == "setVolume" then
        local newVol = math.floor(data.vol) / 100
        if exports.xsound:soundExists("carplay_" .. vehStr) then
            exports.xsound:setVolume("carplay_" .. vehStr, newVol)
        end
        state:set('carplay_volume', newVol, true)
    elseif data.event == "selectTime" then
        if exports.xsound:soundExists("carplay_" .. vehStr) then
            exports.xsound:setTimeStamp("carplay_" .. vehStr, math.floor(data.newTime))
        end
    elseif data.event == "restartSong" then
        if exports.xsound:soundExists("carplay_" .. vehStr) then
            exports.xsound:setTimeStamp("carplay_" .. vehStr, 0)
        end
    elseif data.event == "nextSong" then
        local currQueue = state.carplay_queue
        local currQueuePos = state.carplay_queuePos or 1

        if not currQueue or not currQueue[currQueuePos + 1] then
            if exports.xsound:soundExists("carplay_" .. vehStr) then
                exports.xsound:Destroy("carplay_" .. vehStr)
            end
            if isUiOpen and currentVeh == veh then
                SendNUIMessage({ event = "resetPlayback" })
            end
            return
        end

        local nextData = currQueue[currQueuePos + 1]
        nextData.shouldForce = true
        nextData.queuePos = currQueuePos + 1

        local peds = getPeds(veh)
        TriggerServerEvent("cad-carplay:syncmusic", peds, data.veh, nextData)
    end
end)

RegisterNetEvent('cad-carplay:clientPlayPlaylist', function(firstSong)
    local veh = NetToVeh(firstSong.veh)
    if DoesEntityExist(veh) then
        local peds = getPeds(veh)
        TriggerServerEvent("cad-carplay:syncmusic", peds, firstSong.veh, firstSong)
    end
end)

-- Relay server-pushed NUI messages (e.g. playlistCreated)
RegisterNetEvent('cad-carplay:nuiMessage', function(data)
    if isUiOpen then
        SendNUIMessage(data)
    end
end)

RegisterNUICallback('callback', function(data)
    if data.veh ~= nil then
        local veh = NetToVeh(data.veh)
        if DoesEntityExist(veh) then
            if data.event == "url" or data.event == "forceurl" then
                if data.event == "forceurl" then
                    data.event = "url"
                    data.shouldForce = true
                end
                Entity(veh).state:set('carplay_data', data, true)
            end
            local peds = getPeds(veh)
            TriggerServerEvent("cad-carplay:syncmusic", peds, data.veh, data)
        end
    end
end)

AddStateBagChangeHandler('carplay_queue', nil, function(bagName, key, value, _unused, replicated)
    local entity = GetEntityFromStateBagName(bagName)
    if entity ~= 0 and isUiOpen and currentVeh == entity then
        SendNUIMessage({
            event = "updateQueue",
            queue = value
        })
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if (GetCurrentResourceName() ~= resourceName) then return end

    for k, v in pairs(spawnedSounds) do
        if DoesEntityExist(v) then
            local state = Entity(v).state
            state:set('carplay_data', nil, true)
            state:set('carplay_currTime', nil, true)
            state:set('carplay_queue', nil, true)
            state:set('carplay_queuePos', 1, true)
            state:set('carplay_isPaused', false, true)
            local vehStr = tostring(VehToNet(v))
            if exports.xsound:soundExists("carplay_" .. vehStr) then
                exports.xsound:Destroy("carplay_" .. vehStr)
            end
        end
    end
end)

lib.onCache('vehicle', function(vehicle)
    if vehicle then
        currentVeh = vehicle
        SetVehicleRadioEnabled(vehicle, false)
        SetUserRadioControlEnabled(false)
        if GetPlayerRadioStationName() ~= nil then
            SetVehRadioStation(vehicle, "OFF")
        end
        vehicleEntered(vehicle)
    else
        currentVeh = nil
    end
end)

lib.addKeybind({
    name = 'carplay',
    description = 'CarPlay',
    defaultKey = 'Q',
    onPressed = function()
        carPlay()
    end
})