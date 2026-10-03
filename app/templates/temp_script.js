
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
        var map, userMarker, destMarker, accuracyCircle;
        var lat = 28.6139, lng = 77.2090;   // default fallback (Delhi)
        var destLat = 28.6139, destLng = 77.2090;
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
        
        async function geocodeDestination() {
            if (dest && dest !== 'Your Destination') {
                try {
                    let response = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(dest));
                    let data = await response.json();
                    if (data && data.length > 0) {
                        destLat = parseFloat(data[0].lat);
                        destLng = parseFloat(data[0].lon);
                    }
                } catch (e) {
                    console.error("Geocoding failed", e);
                }
            } else {
                destLat = lat + 0.045;
                destLng = lng + 0.03;
            }
        }

        async function initMap() {
            await geocodeDestination();
            
            map = L.map('map', { zoomControl: false }).setView([lat, lng], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            /* User marker - Blue */
            var userIcon = L.divIcon({
                className: '',
                html: '<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,0.3),0 0 18px rgba(59,130,246,0.6);"></div>',
                iconSize: [16,16], iconAnchor: [8,8]
            });
            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);

            /* Accuracy circle */
            accuracyCircle = L.circle([lat, lng], {
                radius: 30, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1
            }).addTo(map);

            /* Destination marker */
            var destIcon = L.divIcon({
                className: 'dest-marker',
                html: '<i class="fa-solid fa-location-dot" style="font-size:24px;color:#1F9D72;filter:drop-shadow(0 0 5px #1F9D72);"></i>',
                iconSize: [24,24], iconAnchor: [12,24]
            });
            destMarker = L.marker([destLat, destLng], { icon: destIcon })
                .addTo(map)
                .bindPopup('<b style="color:#1F9D72;">' + loc + '</b>');

            // Fit bounds to show both user and destination initially
            var bounds = new L.LatLngBounds([lat, lng], [destLat, destLng]);
            map.fitBounds(bounds, { padding: [50, 50] });
            
            // Generate Zones around Destination
            
            function formatLoc(str) {
                if(!str) return '';
                return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }
            var loc = formatLoc(dest);
            
window.dangerZones = [];

            // 1. Safe Zone (Low risk + Good signal)
            L.circle([destLat + 0.005, destLng + 0.005], {
                radius: 400, color: '#22c55e', weight: 2,
                fill: true, fillColor: 'rgba(34,197,94,0.06)', dashArray: '6 4'
            }).addTo(map).bindPopup('<b style="color:#22c55e">&#128994; Safe Zone (Central Plaza, ' + loc + ')')</b><br>Low Risk & Good Signal.<br><i>Reason: Normal crowds, well-lit, active police patrol.</i>');

            // 2. Low-risk but Connectivity Alert (Low risk + Weak signal)
            L.circle([destLat - 0.008, destLng + 0.015], {
                radius: 350, color: '#eab308', weight: 2,
                fill: true, fillColor: 'rgba(234,179,8,0.06)', dashArray: '6 4'
            }).addTo(map).bindPopup('<b style="color:#eab308">&#128993; Connectivity Alert (Northern Outskirts, ' + loc + ')')</b><br>Low Risk but Weak Signal.<br><i>Reason: Remote area, high chances of network drops.</i>');

            // 3. Caution + Weak Network (Medium risk + Weak signal)
            L.circle([destLat - 0.012, destLng - 0.005], {
                radius: 500, color: '#f97316', weight: 2,
                fill: true, fillColor: 'rgba(249,115,22,0.06)', dashArray: '6 4'
            }).addTo(map).bindPopup('<b style="color:#f97316">&#128992; Caution Area (Main Market Road, ' + loc + ')')</b><br>Medium Risk + Weak Signal.<br><i>Reason: Extremely crowded, high pickpocketing reports & spotty network.</i>');

            // 4. Danger Zone (High risk + Good signal)
            L.circle([destLat + 0.018, destLng - 0.008], {
                radius: 300, color: '#ef4444', weight: 2,
                fill: true, fillColor: 'rgba(239,68,68,0.06)', dashArray: '6 4'
            }).addTo(map).bindPopup('<b style="color:#ef4444">&#128308; Danger Zone (Abandoned Industrial Park, ' + loc + ')')</b><br>High Risk (>61%) & Good Signal.<br><i>Reason: Recent criminal activities reported. Strictly restricted at night.</i>');
            window.dangerZones.push({lat: destLat + 0.018, lng: destLng - 0.008, radius: 300, name: 'Danger Zone'});

            // 5. Critical Zone (High risk + Weak signal)
            L.circle([destLat + 0.01, destLng + 0.02], {
                radius: 250, color: '#991b1b', weight: 2,
                fill: true, fillColor: 'rgba(153,27,27,0.06)', dashArray: '6 4'
            }).addTo(map).bindPopup('<b style="color:#991b1b">&#128308; Critical Zone (Deep Forest Trail, ' + loc + ')')</b><br>High Risk (>61%) & Weak Signal.<br><i>Reason: Isolated spot with no connectivity and high threat level. DO NOT ENTER.</i>');
            window.dangerZones.push({lat: destLat + 0.01, lng: destLng + 0.02, radius: 250, name: 'Critical Zone'});


            updateCoords(lat, lng);

            /* Start real GPS */
            startRealGPS();
            setTimeout(() => { map.invalidateSize(true); }, 500);
            setTimeout(() => { map.invalidateSize(true); }, 1500);
        }
        
        function checkDangerZones(la, lo) {
            if (window.dangerZones) {
                window.dangerZones.forEach(function(dz) {
                    var dist = haversine(la, lo, dz.lat, dz.lng) * 1000;
                    if (dist < dz.radius) {
                        if (!dz.alerted) {
                            alert("URGENT ALERT: You have entered a " + dz.name + " near your destination! This area is highly restricted based on live reports. Please turn back immediately for your safety.");
                            dz.alerted = true;
                            
                            var statBtn = document.querySelector('.s-btn.green');
                            if (statBtn) {
                                statBtn.classList.remove('green');
                                statBtn.style.background = 'rgba(239,68,68,0.2)';
                                statBtn.style.color = '#ef4444';
                                statBtn.style.border = '1px solid #ef4444';
                                statBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Danger Zone';
                            }
                        }
                    } else {
                        dz.alerted = false;
                    }
                });
            }
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
            var acc    = position.coords.accuracy;           
            var spd    = position.coords.speed;              

            if (!gpsReady) {
                gpsReady = true;
                lat = newLat; lng = newLng;
                prevLat = lat; prevLng = lng;
                map.setView([lat, lng], 13, { animate: true });
                setGPSStatus('live', 'Live GPS Active', 'Accuracy: ±' + Math.round(acc) + 'm');
            }

            prevLat = lat; prevLng = lng;
            lat = newLat; lng = newLng;

            var newLL = new L.LatLng(lat, lng);
            userMarker.setLatLng(newLL);
            accuracyCircle.setLatLng(newLL);
            accuracyCircle.setRadius(acc);
            
            // Only pan to user if not viewing destination explicitly 
            // map.panTo(newLL, { animate: true, duration: 1.5 });

            var d = haversine(prevLat, prevLng, lat, lng);
            if (d > 0.001) {                              
                totalDist += d;
            }
            document.getElementById('statDist').textContent =
                totalDist < 1
                    ? (totalDist * 1000).toFixed(0) + ' m'
                    : totalDist.toFixed(2) + ' km';

            if (spd !== null && spd >= 0) {
                lastSpeed = Math.round(spd * 3.6);       
            } else {
                lastSpeed = Math.round(d * 1000 / 2 * 3.6);
                lastSpeed = Math.min(lastSpeed, 200);
            }
            document.getElementById('speedVal').textContent = lastSpeed;

            document.getElementById('hudAcc').textContent = 'Accuracy: ±' + Math.round(acc) + 'm';
            updateCoords(lat, lng);
            checkDangerZones(lat, lng);

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

                        map.setView([lat, lng], 10, { animate: true });
                        userMarker.setLatLng([lat, lng]);
                        accuracyCircle.setLatLng([lat, lng]);
                        accuracyCircle.setRadius(2000);

                        updateCoords(lat, lng);
                        setGPSStatus('ip', 'IP Location', data.city || 'Unknown city');
                        startSimulatedGPS();
                    }
                })
                .catch(function() {
                    setGPSStatus('error', 'Fallback failed', 'Default: Delhi');
                    startSimulatedGPS();
                });
        }

        /* ── Simulated GPS movement towards destination ── */
        function startSimulatedGPS() {
            setInterval(function() {
                prevLat = lat; prevLng = lng;
                
                // Move somewhat towards the destination to simulate travel!
                var latDiff = destLat - lat;
                var lngDiff = destLng - lng;
                var distToDest = haversine(lat, lng, destLat, destLng);
                
                if (distToDest > 0.1) {
                    lat += latDiff * 0.02 + (Math.random() * 0.0006);
                    lng += lngDiff * 0.02 + (Math.random() * 0.0006);
                } else {
                    lat += (Math.random() * 0.0006) - 0.0003;
                    lng += (Math.random() * 0.0006) - 0.0003;
                }

                var newLL = new L.LatLng(lat, lng);
                userMarker.setLatLng(newLL);
                accuracyCircle.setLatLng(newLL);
                
                var bounds = new L.LatLngBounds([lat, lng], [destLat, destLng]);
                map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1 });

                var d = haversine(prevLat, prevLng, lat, lng);
                totalDist += d;
                document.getElementById('statDist').textContent =
                    totalDist < 1 ? (totalDist*1000).toFixed(0) + ' m' : totalDist.toFixed(2) + ' km';

                var simSpeed = Math.floor(Math.random() * 20) + 25;
                document.getElementById('speedVal').textContent = simSpeed;
                document.getElementById('hudAcc').textContent = 'Accuracy: ±50m (sim)';
                
                updateCoords(lat, lng);
                checkDangerZones(lat, lng);
                
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
