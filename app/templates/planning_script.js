
        const dest    = localStorage.getItem('trip_dest')  || 'Your Destination';
        const emName  = localStorage.getItem('em_name')    || 'Not Set';
        const emPhone = localStorage.getItem('em_phone')   || 'N/A';
        const tourist = JSON.parse(localStorage.getItem('tourist_info') || '{}');

        document.getElementById('navName').textContent  = tourist.name || 'Traveler';
        document.getElementById('destName').textContent = dest;
        document.getElementById('dashDest').textContent = dest;
        document.getElementById('dashEm').innerHTML = '<span class="highlight">' + emName + '</span> - ' + emPhone;

        const etaHours = Math.floor(Math.random() * 4) + 2;
        const etaDate  = new Date(); etaDate.setHours(etaDate.getHours() + etaHours);
        const etaStr   = etaDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        document.getElementById('statETA').textContent     = etaStr;
        document.getElementById('timelineETA').textContent = 'ETA: ' + etaStr;

        const weathers = [
            {icon:'Sunny', temp:'32 C', cond:'Clear Sky'},
            {icon:'Cloudy', temp:'28 C', cond:'Partly Cloudy'},
            {icon:'Rainy', temp:'24 C', cond:'Light Showers'},
            {icon:'Sunny', temp:'30 C', cond:'Mostly Sunny'},
        ];
        const w = weathers[Math.floor(Math.random() * weathers.length)];
        document.getElementById('weatherIcon').textContent = w.icon;
        document.getElementById('weatherTemp').textContent = w.temp;
        document.getElementById('weatherCond').textContent = w.cond;

        const answers = {};

        function pick(step, el) {
            document.getElementById('q' + step).querySelectorAll('.opt').forEach(function(o){ o.classList.remove('selected'); });
            el.classList.add('selected');
            answers['q' + step] = el.textContent.trim();
            document.getElementById('btn' + step).classList.add('active');
        }

        function updateProgress(step) {
            var pct = Math.round((step / 4) * 100);
            document.getElementById('progressFill').style.width = pct + '%';
            document.getElementById('stepLabel').textContent = 'Step ' + step + ' of 4';
            document.getElementById('stepPct').textContent   = pct + '%';
        }

        function goNext(from) {
            var card = document.getElementById('cardInner');
            card.classList.add('card-out');
            setTimeout(function() {
                document.getElementById('q' + from).style.display = 'none';
                var next = document.getElementById('q' + (from + 1));
                next.style.display = 'block';
                updateProgress(from + 1);
                card.classList.remove('card-out');
                void card.offsetWidth;
            }, 380);
        }

        function launchDash() {
            localStorage.setItem('trip_answers', JSON.stringify(answers));
            document.getElementById('quizScene').classList.add('exiting');
            var trans = document.getElementById('transScreen');
            trans.classList.add('show');
            setTimeout(function() {
                trans.style.opacity = '0';
                document.getElementById('dashWrap').classList.add('show');
                document.body.style.overflow = 'hidden';
                initMap();
            }, 1800);
            setTimeout(function() { trans.style.display = 'none'; }, 2300);
        }        /* ── GPS State ── */
        var map, userMarker, destMarker, routeLine, accuracyCircle;
        var lat = 28.6139, lng = 77.2090;   // default fallback (Delhi)
        var prevLat = lat, prevLng = lng;
        var totalDist = 0, moveCount = 0;
        var gpsWatchId = null;
        var gpsReady = false;
        var lastSpeed = 0;

        /* ── Haversine distance (km) ── */
        function haversine(la1, lo1, la2, lo2) {
            var R = 6371;
            var dLat = (la2 - la1) * Math.PI / 180;
            var dLon = (lo2 - lo1) * Math.PI / 180;
            var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
                    Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*
                    Math.sin(dLon/2)*Math.sin(dLon/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }

        function initMap() {
            map = L.map('map', { zoomControl: false }).setView([lat, lng], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            /* User marker */
            var userIcon = L.divIcon({
                className: '',
                html: '<div class="live-marker"></div>',
                iconSize: [18,18], iconAnchor: [9,9]
            });
            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);

            /* Accuracy circle */
            accuracyCircle = L.circle([lat, lng], {
                radius: 30,
                color: 'rgba(31,157,114,0.5)',
                fillColor: 'rgba(31,157,114,0.08)',
                fillOpacity: 1,
                weight: 1
            }).addTo(map);

            /* Destination marker */
            var destLat = lat + 0.045, destLng = lng + 0.03;
            var destIcon = L.divIcon({
                className: '',
                html: '<div style="width:16px;height:16px;background:#38bdf8;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px #38bdf8;"></div>',
                iconSize: [16,16], iconAnchor: [8,8]
            });
            destMarker = L.marker([destLat, destLng], { icon: destIcon })
                .addTo(map)
                .bindPopup('<b style="color:#1F9D72;">' + dest + '</b>');

            /* Route line */
            

            updateCoords(lat, lng);

            /* Start real GPS */
            startRealGPS();
        }

        /* ── Real GPS using browser Geolocation API ── */
        function startRealGPS() {
            if (!navigator.geolocation) {
                setGPSStatus('error', 'GPS not supported', 'Using fallback');
                startSimulatedGPS();
                return;
            }

            setGPSStatus('acquiring', 'Acquiring GPS...', 'Requesting permission');

            /* First: get immediate position */
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    onGPSSuccess(pos);
                    /* Then: watch for continuous updates */
                    gpsWatchId = navigator.geolocation.watchPosition(
                        onGPSSuccess,
                        onGPSError,
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 2000
                        }
                    );
                },
                function(err) {
                    onGPSError(err);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }

        /* ── Called every time GPS gives a new position ── */
        function onGPSSuccess(position) {
            var newLat = position.coords.latitude;
            var newLng = position.coords.longitude;
            var acc    = position.coords.accuracy;           /* metres */
            var spd    = position.coords.speed;              /* m/s or null */
            var head   = position.coords.heading;

            /* First fix — centre map on real location */
            if (!gpsReady) {
                gpsReady = true;
                lat = newLat; lng = newLng;
                prevLat = lat; prevLng = lng;
                map.setView([lat, lng], 16, { animate: true });

                /* Reposition destination relative to real location */
                var destLat = lat + 0.045, destLng = lng + 0.03;
                destMarker.setLatLng([destLat, destLng]);
                routeLine.setLatLngs([[lat, lng], [destLat, destLng]]);

                setGPSStatus('live', 'Live GPS Active', 'Accuracy: ±' + Math.round(acc) + 'm');
            }

            prevLat = lat; prevLng = lng;
            lat = newLat; lng = newLng;

            /* Update marker + accuracy circle */
            var newLL = new L.LatLng(lat, lng);
            userMarker.setLatLng(newLL);
            accuracyCircle.setLatLng(newLL);
            accuracyCircle.setRadius(acc);
            map.panTo(newLL, { animate: true, duration: 1.5 });

            /* Update route start */
            var lls = routeLine.getLatLngs();
            routeLine.setLatLngs([newLL, lls[lls.length - 1]]);

            /* Distance */
            var d = haversine(prevLat, prevLng, lat, lng);
            if (d > 0.001) {                              /* ignore jitter < 1m */
                totalDist += d;
            }
            document.getElementById('statDist').textContent =
                totalDist < 1
                    ? (totalDist * 1000).toFixed(0) + ' m'
                    : totalDist.toFixed(2) + ' km';

            /* Speed — use GPS speed if available, else calculate */
            if (spd !== null && spd >= 0) {
                lastSpeed = Math.round(spd * 3.6);       /* m/s → km/h */
            } else {
                /* estimate from distance / time (2s watch interval) */
                lastSpeed = Math.round(d * 1000 / 2 * 3.6);
                lastSpeed = Math.min(lastSpeed, 200);
            }
            document.getElementById('speedVal').textContent = lastSpeed;

            /* Accuracy HUD */
            document.getElementById('hudAcc').textContent =
                'Accuracy: ±' + Math.round(acc) + 'm';

            /* Coords */
            updateCoords(lat, lng);

            /* Timeline */
            moveCount++;
            if (moveCount % 3 === 0) {
                document.getElementById('timelineSub').textContent =
                    totalDist < 1
                        ? 'Moving... ' + (totalDist*1000).toFixed(0) + 'm covered'
                        : 'Moving... ' + totalDist.toFixed(2) + 'km covered';
            }
        }

        /* ── GPS Error handler ── */
        function onGPSError(err) {
            var msg = '';
            switch(err.code) {
                case 1: msg = 'Permission denied'; break;
                case 2: msg = 'Position unavailable'; break;
                case 3: msg = 'GPS timeout'; break;
                default: msg = 'GPS error';
            }
            setGPSStatus('error', msg, 'Using IP fallback');

            /* Try IP-based location as fallback */
            fetchIPLocation();
        }

        /* ── IP Geolocation fallback ── */
        function fetchIPLocation() {
            fetch('https://ipapi.co/json/')
                .then(function(r){ return r.json(); })
                .then(function(data) {
                    if (data.latitude && data.longitude) {
                        lat = parseFloat(data.latitude);
                        lng = parseFloat(data.longitude);
                        prevLat = lat; prevLng = lng;

                        map.setView([lat, lng], 13, { animate: true });
                        userMarker.setLatLng([lat, lng]);
                        accuracyCircle.setLatLng([lat, lng]);
                        accuracyCircle.setRadius(2000);

                        var destLat = lat + 0.045, destLng = lng + 0.03;
                        destMarker.setLatLng([destLat, destLng]);
                        routeLine.setLatLngs([[lat,lng],[destLat,destLng]]);

                        updateCoords(lat, lng);
                        setGPSStatus('ip', 'IP Location', data.city || 'Unknown city');

                        /* Simulate movement from real IP location */
                        startSimulatedGPS();
                    }
                })
                .catch(function() {
                    setGPSStatus('error', 'Fallback failed', 'Default: Delhi');
                    startSimulatedGPS();
                });
        }

        /* ── Simulated GPS movement (fallback when real GPS unavailable) ── */
        function startSimulatedGPS() {
            setInterval(function() {
                prevLat = lat; prevLng = lng;
                lat += (Math.random() * 0.0006) + 0.00005;
                lng += (Math.random() * 0.0006) - 0.0003;

                var newLL = new L.LatLng(lat, lng);
                userMarker.setLatLng(newLL);
                accuracyCircle.setLatLng(newLL);
                map.panTo(newLL, { animate: true, duration: 1.2 });

                var lls = routeLine.getLatLngs();
                routeLine.setLatLngs([newLL, lls[lls.length-1]]);

                var d = haversine(prevLat, prevLng, lat, lng);
                totalDist += d;
                document.getElementById('statDist').textContent =
                    totalDist < 1
                        ? (totalDist*1000).toFixed(0) + ' m'
                        : totalDist.toFixed(2) + ' km';

                var simSpeed = Math.floor(Math.random() * 20) + 25;
                document.getElementById('speedVal').textContent = simSpeed;
                document.getElementById('hudAcc').textContent = 'Accuracy: ±50m (sim)';
                updateCoords(lat, lng);
                moveCount++;
                if (moveCount % 4 === 0) {
                    document.getElementById('timelineSub').textContent =
                        'Moving... ' + (totalDist*1000).toFixed(0) + 'm covered';
                }
            }, 3000);
        }

        /* ── GPS HUD status helper ── */
        function setGPSStatus(state, label, sub) {
            var dot  = document.querySelector('.gps-dot');
            var lbl  = document.getElementById('hudLabel');
            var hsub = document.getElementById('hudAcc');

            if (lbl) lbl.textContent  = label;
            if (hsub) hsub.textContent = sub;

            if (dot) {
                if (state === 'live')      dot.style.background = '#1F9D72';
                else if (state === 'ip')   dot.style.background = '#f59e0b';
                else if (state === 'error')dot.style.background = '#ef4444';
                else                       dot.style.background = '#38bdf8';  /* acquiring */
            }
        }

        function updateCoords(la, lo) {
            var latDir = la >= 0 ? 'N' : 'S';
            var lngDir = lo >= 0 ? 'E' : 'W';
            document.getElementById('coordsText').textContent =
                Math.abs(la).toFixed(5) + '° ' + latDir + ',  ' +
                Math.abs(lo).toFixed(5) + '° ' + lngDir;
        }

        /* ── SOS ── */
        function triggerSOS() {
            var btn     = document.getElementById('sosBtn');
            var overlay = document.getElementById('sosOverlay');
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending SOS...';
            btn.style.opacity = '0.7';
            overlay.style.opacity = '1';

            /* Attach current real coords to SOS */
            var sosCoords = lat.toFixed(5) + ', ' + lng.toFixed(5);
            console.log('[SOS] Location:', sosCoords);

            setTimeout(function() {
                overlay.style.opacity = '0';
                btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> SOS Sent to ' + emName;
                btn.style.background = 'linear-gradient(135deg,rgba(31,157,114,0.85),rgba(16,120,90,0.9))';
                btn.style.borderColor = 'rgba(31,157,114,0.5)';
                setTimeout(function() {
                    btn.innerHTML = '<i class="fa-solid fa-bell-exclamation"></i> SOS ALERT';
                    btn.style.background = '';
                    btn.style.borderColor = '';
                    btn.style.opacity = '1';
                }, 4000);
            }, 2000);
        }
    