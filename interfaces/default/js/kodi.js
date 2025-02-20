var searchString = '';
var hideWatched = 0;
var playerLoader = null;
var position1 = null;
var sorting = {
    method:'title',
    order: 'ascending'
}

$(document).ready(function() {
    playerLoader = setInterval('loadNowPlaying()', 1000);
    hideWatched = $('#hidewatched').hasClass('active')?1:0;
    $('.formsearch').submit(function(e) {
        e.preventDefault()
    });

    // Load data on tab display
    $('a[data-toggle="tab"]').click(function(e) {
        $('.search').val('')
        searchString = ''
    }).on('shown', reloadTab);
    $(window).trigger('hashchange')

    loadShowFromHash(location.hash);

    // Catch keyboard event and send to kodi
    $(document).keydown(function(e) {
        if (!$('input').is(":focus")) {

            arrow = {8: 'back', 27: 'back', 13: 'select', 37: 'left', 38: 'up', 39: 'right', 40: 'down',
                     88: 'stop', 32: 'playpause', 67: 'contextmenu', 73: 'info', 77: 'mute'};

            command = arrow[e.which];
            if (command) {
                $.get(WEBDIR + 'kodi/ControlPlayer?action='+command);
                e.preventDefault();
            }
        }
    });

    // Load serverlist and send command on change.
    var servers = $('#servers').change(function() {
         $.get(WEBDIR + 'kodi/changeserver?id='+$(this).val(), function(data) {
            notify('kodi','Server change '+data,'info');
         });
    });
    $.get(WEBDIR + 'kodi/getserver', function(data) {
        if (data==null) return;
        $.each(data.servers, function(i, item) {
            server = $('<option>').text(item.name).val(item.id);
            if (item.name == data.current) server.attr('selected','selected');
            servers.append(server);
        });
    }, 'json');

    // Enable player controls
    $('[data-player-control]').click(function () {
        var action = $(this).attr('data-player-control');
        $.get(WEBDIR + 'kodi/ControlPlayer?action='+action);
    });
    $('#nowplaying #player-progressbar').click(function(e) {
        pos = ((e.pageX-this.offsetLeft)/$(this).width()*100).toFixed(2);
        $.get(WEBDIR + 'kodi/ControlPlayer?action=seek&value='+pos);
    });
    $('#nowplaying #player-volume-progressbar').click(function(e) {
        vol = ((e.pageX-this.offsetLeft)/$(this).width()*100).toFixed();
        $.get(WEBDIR + 'kodi/ControlPlayer?action=volume&value='+vol);
    });

    // Slider for volume
    $('#ex1').slider({
        formater: function(value) {
            if (value === 0) {
                $.get(WEBDIR + 'kodi/NowPlaying', function(data) {
                    $('#ex1').slider('setValue', data.app.volume, []);
                });
            } else {
                $.get(WEBDIR + 'kodi/ControlPlayer?action=volume&value='+value);
                return 'Volume: ' + value;
            }
        }
    });

    // Toggle whether to show already seen episodes
    $('#hidewatched').click(function(e) {
        e.preventDefault();
        hideWatched = $(this).toggleClass('active').hasClass('active')?1:0;
        $(this).text(hideWatched?' Show Watched':' Hide Watched');
        $(this).prepend('<i class="fa fa-eye"></i>');
        $.get(WEBDIR + 'settings?kodi_hide_watched='+hideWatched);
        reloadTab();
    });

    // Define sort method
    $('[data-sort-method]').click(function (e) {
        e.preventDefault();
        sorting.method = $(this).attr('data-sort-method');
        sorting.order = $(this).attr('data-sort-order');
        $('[data-sort-method]').removeClass('active');
        $(this).addClass('active');
        reloadTab();
    });

    // Send notification to kodi
    $('#kodi-notify').click(function() {
        msg = prompt("Message");
        if (msg) {
            $.post(WEBDIR + 'kodi/Notify',{'text': msg}, function(data) {
                notify('kodi', 'Notification sent successfully', 'info');
            });
        }
    });

    // Show subtitle selector if current has a subtitle track
    var subtitles = $('#subtitles').change(function() {
        $.get(WEBDIR + 'kodi/Subtitles?subtitle='+$(this).val(), function (data) {
            notify('Subtitles','Change successful','info');
        });
    });
    // Show audio selector if current has multiple subtitles tracks
    var audio = $('#audio').change(function() {
        $.get(WEBDIR + 'kodi/Audio?audio='+$(this).val(), function (data) {
            notify('Audio','Change successful','info');
        });
    });

    // Make the playlist sortable
    $('#playlist-table tbody').sortable({
        handle: ".handle",
        containment: "parent",
        start: function(event, ui) {
            clearInterval(playerLoader);
            position1 = ui.item.index()
        },
        stop: function(event, ui) {
            $.get(WEBDIR + 'kodi/PlaylistMove',{
                position1: position1,
                position2: ui.item.index()
            }, function (data) {
                nowPlayingId = null
                playerLoader = setInterval('loadNowPlaying()', 1000)
            });
        }
    });

    // Filter on searchfield changes
    $(".search").on('keyup', function (e) {
        searchString = $(this).val();
        reloadTab()
    });

    // Load more titles on scroll
    $(window).scroll(function() {
        if($(window).scrollTop() + $(window).height() >= $(document).height() - 10) {
            reloadTab()
        }

    });
});

var movieLoad = {
    last: 0,
    request: null,
    limit: 75,
    options: null
}
function loadMovies(options) {
    var optionstr = JSON.stringify(options) + hideWatched + JSON.stringify(sorting);
    if (movieLoad.options != optionstr) {
        movieLoad.last = 0;
        $('#movie-grid').empty();
    }
    if (movieLoad.last == 0) {
        $('#movie-grid').empty();
    }
    movieLoad.options = optionstr;

    var active = (movieLoad.request!=null && movieLoad.request.readyState!=4);
    if (active || movieLoad.last == -1) return;

    var sendData = {
        start: movieLoad.last,
        end: (movieLoad.last + movieLoad.limit),
        hidewatched: hideWatched,
        sortmethod: sorting.method,
        sortorder: sorting.order
    }
    $.extend(sendData, options);

    $('.spinner').show();
    movieLoad.request = $.ajax({
        url: WEBDIR + 'kodi/GetMovies',
        type: 'get',
        data: sendData,
        dataType: 'json',
        success: function (data) {
            if (data == null) return errorHandler();

            if (data.limits.end == data.limits.total) {
                movieLoad.last = -1;
            } else {
                movieLoad.last += movieLoad.limit;
            }

            if (data.movies != undefined) {
                $.each(data.movies, function (i, movie) {
                    var movieItem = $('<li>').attr('title', movie.title);

                    var movieAnchor = $('<a>').attr('href', '#').click(function(e) {
                        e.preventDefault();
                        loadMovie(movie);
                    });

                    var src = 'holder.js/100x150/text:No artwork';
                    if (movie.thumbnail != '') {
                        src = WEBDIR + 'kodi/GetThumb?w=225&h=338&thumb='+encodeURIComponent(movie.thumbnail);
                    }
                    movieAnchor.append($('<img>').attr('src', src).addClass('thumbnail'));

                    if (movie.playcount >= 1) {
                        movieAnchor.append($('<i>').attr('title', 'Watched').addClass('fa fa-check-circle fa-inverse watched'));
                    }

                    movieAnchor.append($('<h6>').addClass('title').html(shortenText(movie.title, 16)));

                    movieItem.append(movieAnchor);

                    $('#movie-grid').append(movieItem);
                });
            }
            Holder.run();
        },
        complete: function() {
            $('.spinner').hide();
        }
    });
}

function loadMovie(movie) {
    var poster = WEBDIR + 'kodi/GetThumb?w=200&h=300&thumb='+encodeURIComponent(movie.thumbnail)
    var info = $('<div>').addClass('modal-movieinfo');
    if (movie.streamdetails && movie.streamdetails.video[0]) {
        var runtime = parseSec(movie.streamdetails.video[0].duration);
        info.append($('<p>').html('<b>Runtime:</b> ' + runtime));
    }
    info.append($('<p>').html('<b>Plot:</b> ' + movie.plot));
    if (movie.genre) {
        var genre = movie.genre.join(', ');
        info.append($('<p>').html('<b>Genre:</b> ' + genre));
    }
    if (movie.studio) {
        var studio = movie.studio.join(', ');
        info.append($('<p>').html('<b>Studio:</b> ' + studio));
    }
    if (movie.rating) {
        info.append($('<span>').raty({
            readOnly: true,
            path: null,
            score: (movie.rating / 2),
        }));
    }
    var buttons = {
        'Play' : function() {
            playItem(movie.movieid, 'movie');
            hideModal();
        }
    }
    if (movie.imdbnumber) {
        $.extend(buttons,{
            'IMDb' : function() {
                window.open('http://www.imdb.com/title/'+movie.imdbnumber,'IMDb')
            }
        });
    }
    if (movie.trailer) {
        $.extend(buttons,{
            'Trailer' : function() {
                var trailerid = movie.trailer.substr(movie.trailer.length-11);
                var src = 'http://www.youtube.com/embed/'+trailerid+'?rel=0&autoplay=1'
                var youtube = $('<iframe allowfullscreen>').attr('src',src).addClass('modal-youtube');
                $('#modal_dialog .modal-body').html(youtube);
            }
        });
    }
    showModal(movie.title + ' ('+movie.year+')', $('<div>').append(
        $('<img>').attr('src', poster).addClass('thumbnail movie-poster pull-left'),
        info
    ), buttons);
    $('.modal-fanart').css({
        'background-image' : 'url(' + WEBDIR + 'kodi/GetThumb?w=675&h=400&o=10&thumb='+encodeURIComponent(movie.fanart)+')'
    });
}

function loadEpisode(episode) {
    var poster = WEBDIR + 'kodi/GetThumb?w=200&h=300&thumb='+encodeURIComponent(episode.thumbnail)
    var info = $('<div>').addClass('modal-episodeinfo');
    if (episode.streamdetails && episode.streamdetails.video[0]) {
        var runtime = parseSec(episode.streamdetails.video[0].duration);
        info.append($('<p>').html('<b>Runtime: </b> ' + runtime));
    }
    info.append($('<p>').html('<b>Plot: </b> ' + episode.plot));
    if (episode.genre) {
        var genre = episode.genre.join(', ');
        info.append($('<p>').html('<b>Genre: </b> ' + genre));
    }
    if (episode.playcount) {
        info.append($('<p>').html('<b>Seen: </b>' + episode.playcount + ' times'))
    }
    if (episode.file) {
        info.append($('<p>').html('<b>File: </b>' + episode.file))
    }

    if (episode.studio) {
        var studio = episode.studio.join(', ');
        info.append($('<p>').html('<b>Studio: </b> ' + studio));
    }
    if (episode.rating) {
        info.append($('<span>').raty({
            readOnly: true,
            path: null,
            score: (episode.rating / 2),
        }));
    }
    var buttons = {
        'Play' : function() {
            playItem(episode.episodeid, 'episode');
            hideModal();
        }
    }

    showModal(episode.label,  $('<div>').append(
        $('<img>').attr('src', poster).addClass('thumbnail episode-poster pull-left'), info),
        buttons);

    $('.modal-fanart').css({
        'background-image' : 'url('+WEBDIR+'kodi/GetThumb?w=675&h=400&o=10&thumb='+encodeURIComponent(episode.thumbnail)+')'
    });
}

var showLoad = {
    last: 0,
    request: null,
    limit: 75,
    options: null
}
function loadShows(options) {
    var optionstr = JSON.stringify(options) + hideWatched + JSON.stringify(sorting);
    if (showLoad.options != optionstr) {
        showLoad.last = 0;
        $('#show-grid').empty();
    }
    if (showLoad.last == 0) {
        $('#show-grid').empty();
    }
    showLoad.options = optionstr;

    var active = (showLoad.request!=null && showLoad.request.readyState!=4);
    if (active || showLoad.last == -1) return;

    var sendData = {
        start: showLoad.last,
        end: (showLoad.last + showLoad.limit),
        hidewatched: hideWatched,
        sortmethod: sorting.method,
        sortorder: sorting.order
    }
    $.extend(sendData, options);

    $('.spinner').show();
    showLoad.request = $.ajax({
        url: WEBDIR + 'kodi/GetShows',
        type: 'get',
        data: sendData,
        dataType: 'json',
        success: function (data) {
            if (data == null) return errorHandler();

            if (data.limits.end == data.limits.total) {
                showLoad.last = -1;
            } else {
                showLoad.last += showLoad.limit;
            }

            if (data.tvshows != undefined) {
                $.each(data.tvshows, function (i, show) {
                    var showItem = $('<li>').attr('title', show.title);

                    var showAnchor = $('<a>').attr('href', '#tvshow-' + show.tvshowid).click(function(e) {
                        e.preventDefault();
                        loadEpisodes({'tvshowid':show.tvshowid})
                    });

                    var src = 'holder.js/100x150/text:No artwork';
                    if (show.thumbnail != '') {
                        src = WEBDIR + 'kodi/GetThumb?w=100&h=150&thumb='+encodeURIComponent(show.thumbnail);
                    }
                    showAnchor.append($('<img>').attr('src', src).addClass('thumbnail'));

                    if (show.playcount >= 1) {
                        showAnchor.append($('<i>').attr('title', 'Watched').addClass('fa fa-check-circle fa-inverse watched'));
                    }

                    showAnchor.append($('<h6>').addClass('title').html(shortenText(show.title, 16)));

                    showItem.append(showAnchor);

                    $('#show-grid').append(showItem);
                });
            }
            Holder.run();
        },
        complete: function() {
            $('.spinner').hide();
        }
    });
}

var episodeLoad = {
    last: 0,
    request: null,
    limit: 75,
    options: null
}
var currentShow = null;
function loadEpisodes(options) {
    currentShow = options.tvshowid;
    var optionstr = JSON.stringify(options) + hideWatched;
    if (episodeLoad.options != optionstr) {
        episodeLoad.last = 0;
        $('#episode-grid').empty();
    }
    if (episodeLoad.last == 0) {
        $('#episode-grid').empty();
    }
    episodeLoad.options = optionstr;

    var active = (episodeLoad.request!=null && episodeLoad.request.readyState!=4);
    if (active || episodeLoad.last == -1) return;

    var sendData = {
        start: episodeLoad.last,
        end: (episodeLoad.last + episodeLoad.limit),
        hidewatched: hideWatched
    }
    $.extend(sendData, options);

    $('.spinner').show();
    episodeLoad.request = $.ajax({
        url: WEBDIR + 'kodi/GetEpisodes',
        type: 'get',
        data: sendData,
        dataType: 'json',
        success: function (data) {
            if (data==null || data.limits.total==0) return;

            if (data.limits.end == data.limits.total) {
                episodeLoad.last = -1;
            } else {
                episodeLoad.last += episodeLoad.limit;
            }

            if (data.episodes != undefined) {
                $.each(data.episodes, function (i, episode) {
                    var episodeItem = $('<li>').attr('title', episode.plot);

                    var episodeAnchor = $('<a>').attr('href', '#').click(function(e) {
                        e.preventDefault();
                        loadEpisode(episode);
                    });

                    var src = 'holder.js/150x85/text:No artwork';
                    if (episode.thumbnail != '') {
                        src = WEBDIR + 'kodi/GetThumb?w=375&h=210&thumb='+encodeURIComponent(episode.thumbnail);
                    }
                    episodeAnchor.append($('<img>').attr('src', src).addClass('thumbnail'));

                    if (episode.playcount >= 1) {
                        episodeAnchor.append($('<i>').attr('title', 'Watched').addClass('fa fa-check-circle fa-inverse watched-episode'));
                    }

                    episodeAnchor.append($('<h6>').addClass('title').html(shortenText(episode.label, 18)));

                    episodeItem.append(episodeAnchor);

                    $('#episode-grid').append(episodeItem);
                });
            }
            Holder.run();
        },
        complete: function() {
            $('.spinner').hide();
            $('a[href="#episodes"]').tab('show');
        }
    });
    $('#episode-grid').slideDown()
}

var artistLoad = {
    last: 0,
    request: null,
    limit: 75,
    options: null
}
function loadArtists(options) {
    var optionstr = JSON.stringify(options);
    if (artistLoad.options != optionstr) {
        artistLoad.last = 0;
        $('#artist-grid').empty();
    }
    if (artistLoad.last == 0) {
        $('#artist-grid').empty();
    }
    artistLoad.options = optionstr;

    var active = (artistLoad.request!=null && artistLoad.request.readyState!=4);
    if (active || artistLoad.last == -1) return;

    var sendData = {
        start: artistLoad.last,
        end: (artistLoad.last + artistLoad.limit)
    }
    $.extend(sendData, options);

    $('.spinner').show();
    artistLoad.request = $.ajax({
        url: WEBDIR + 'kodi/GetArtists',
        type: 'get',
        data: sendData,
        dataType: 'json',
        success: function (data) {
            if (data == null) return errorHandler();

            if (data.limits.end == data.limits.total) {
                artistLoad.last = -1;
            } else {
                artistLoad.last += artistLoad.limit;
            }

            if (data.artists != undefined) {
                $.each(data.artists, function (i, artist) {
                    $('#artist-grid').append($('<tr>').append(
                        $('<td>').append(
                            $('<a>').attr('href','#').attr('title', 'Play all').html('<i class="fa fa-play">').click(function(e) {
                                e.preventDefault();
                                playItem(artist.artistid, 'artist');
                            }),
                            $('<a>').attr('href','#').attr('title', 'Enqueue all').html('<i class="fa fa-plus">').click(function(e) {
                                e.preventDefault();
                                queueItem(artist.artistid, 'artist');
                            })
                        ),
                        $('<td>').append(
                            $('<a>').attr('href','#').addClass('artist-link').html(artist.label).click(function(e) {
                                e.preventDefault(e);
                                $(this).parent().append(loadAlbums({'artistid' : artist.artistid}));
                            })
                        )
                    ));
                });
            }
            Holder.run();
        },
        complete: function() {
            $('.spinner').hide();
        }
    });
}

var albumLoad = {
    last: 0,
    request: null,
    limit: 75,
    options: null,
    artist: null
}
function loadAlbums(options) {
    var elem = $('#album-grid');
    if (options && options.artistid!=undefined) {
        $('.artist-albums:visible').slideUp(300, function() {
            $(this).remove();
        });
        if (options.artistid == loadAlbums.artist) {
            loadAlbums.artist = null;
            return;
        }
        loadAlbums.artist = options.artistid;
        var elem = $('<ul>').addClass('artist-albums thumbnails').hide()
    }

    var optionstr = JSON.stringify(options);
    if (albumLoad.options != optionstr) {
        albumLoad.last = 0;
        elem.empty();
    }
    albumLoad.options = optionstr;

    var active = (albumLoad.request!=null && albumLoad.request.readyState!=4);
    if (active || albumLoad.last == -1) return;

    var sendData = {
        start: albumLoad.last,
        end: (albumLoad.last + albumLoad.limit)
    }
    $.extend(sendData, options);

    $('.spinner').show();
    albumLoad.request = $.ajax({
        url: WEBDIR + 'kodi/GetAlbums',
        type: 'get',
        data: sendData,
        dataType: 'json',
        success: function (data) {
            if (data == null) return errorHandler();

            if (data.limits.end == data.limits.total) {
                albumLoad.last = -1;
            } else {
                albumLoad.last += albumLoad.limit;
            }

            if (data.albums != undefined) {
                $.each(data.albums, function (i, album) {
                    var albumItem = $('<li>').hover(function() {
                        $(this).children('div').fadeToggle()
                    });

                    var src = 'holder.js/150x150/text:No artwork';
                    if (album.thumbnail != '') {
                        src = WEBDIR + 'kodi/GetThumb?w=150&h=150&thumb='+encodeURIComponent(album.thumbnail);
                    }
                    albumItem.append($('<img>').attr('src', src).addClass('thumbnail'));

                    var albumCaption = $('<div>').addClass('grid-caption hide').append(
                        $('<a>').attr('href', '#').append(
                                $('<h6>').html(album.title),
                                $('<h6>').html(album.artist).addClass('artist')
                            ).click(function(e) {
                                e.preventDefault();
                                loadSongs({'albumid': album.albumid, 'search': album.title});
                            }),
                        $('<div>').addClass('grid-control').append(
                            $('<a>').attr('href', '#').append(
                                $('<img>').attr('src',WEBDIR + 'img/play.png').attr('title','Play')
                            ).click(function(e) {
                                e.preventDefault();
                                playItem(album.albumid, 'album');
                            }),
                            $('<a>').attr('href', '#').append(
                                $('<img>').attr('src',WEBDIR + 'img/add.png').attr('title','Queue')
                            ).click(function(e) {
                                e.preventDefault();
                                queueItem(album.albumid, 'album');
                                notify('Added', 'Album has been added to the playlist.', 'info');
                            })
                        )
                    )
                    albumItem.append(albumCaption);
                    elem.append(albumItem);
                });
            }
            Holder.run();
            elem.slideDown();
        },
        complete: function() {
            $('.spinner').hide();
        }
    });
    return elem;
}

var songsLoad = {
    last: 0,
    request: null,
    limit: 75,
    options: {},
    filter: ''
}
function loadSongs(options) {
    searchString = $('.search').val()
    if (songLoad.last == 0) {
        $('#songs-grid tbody').empty();
    }
    if (options != undefined || searchString != songsLoad.filter) {
        songsLoad.last = 0
        $('#songs-grid tbody').empty()
        if (options != undefined) {
            songsLoad.options = options
            if (options.search) {
                $(".search").val(options.search);
                songsLoad.filter = options.search
            }
        } else {
            songsLoad.options = {}
            songsLoad.filter = searchString
        }
    }

    var active = (songsLoad.request!=null && songsLoad.request.readyState!=4)
    if (active || songsLoad.last == -1) return

    var sendData = {
        start: songsLoad.last,
        end: (songsLoad.last + songsLoad.limit),
        filter: (options && options.search ? '' : songsLoad.filter)
    }
    $.extend(sendData, songsLoad.options)

    $('.spinner').show();
    songsLoad.request = $.ajax({
        url: WEBDIR + 'kodi/GetSongs',
        type: 'get',
        data: sendData,
        dataType: 'json',
        success: function (data) {
            if (data==null || data.limits.total==0) return;

            if (data.limits.end == data.limits.total) {
                songsLoad.last = -1;
            } else {
                songsLoad.last += songsLoad.limit;
            }
            if (data.songs != undefined) {
                $.each(data.songs, function (i, song) {
                    var row = $('<tr>');
                    row.append(
                        $('<td>').append(
                            $('<a>').attr('href','#').append($('<i>').addClass('fa fa-plus')).click(function(e) {
                                e.preventDefault();
                                queueItem(song.songid, 'song')
                            }),
                            $('<a>').attr('href','#').text(' ' + song.label).click(function(e) {
                                e.preventDefault();
                                playItem(song.songid, 'song')
                            })
                        ),
                        $('<td>').append(
                            $('<a>').attr('href','#').text(song.artist).click(function(e) {
                                e.preventDefault();
                                loadSongs({'artistid': song.artistid[0], 'search': song.artist})
                            })
                        ),
                        $('<td>').append(
                            $('<a>').attr('href','#').text(song.album).click(function(e) {
                                e.preventDefault();
                                loadSongs({'albumid': song.albumid, 'search': song.album})
                            })
                        ),
                        $('<td>').append(parseSec(song.duration))
                    )
                    $('#songs-grid tbody').append(row);
                });
            }
        },
        complete: function() {
            $('a[href="#songs"]').tab('show');
            $('.spinner').hide();
        }
    });
}

var channelsLoaded = false;
function loadChannels(){
    if (channelsLoaded) return;
    var list = $('#pvr-grid').empty();
    $('.spinner').show();
    $.ajax({
        url: WEBDIR + 'kodi/GetChannels',
        type: 'get',
        dataType: 'json',
        success: function(data){
            $('.spinner').hide();
            if (data == null) return errorHandler();
            $.each(data.channels, function (i, channel) {
                var item = $('<li>').attr('title', channel.label);
                var link = $('<a>').attr('href', '#').click(function(e) {
                    e.preventDefault();
                    playItem(channel.channelid, 'channel');
                });
                var src = 'holder.js/75x75/text:'+channel.label;
                if (channel.thumbnail) {
                    src = WEBDIR + 'kodi/GetThumb?w=75&h=75&thumb='+encodeURIComponent(channel.thumbnail);
                }
                link.append($('<img>').attr('src', src).addClass('thumbnail'));
                link.append($('<h6>').addClass('title').html(shortenText(channel.label, 21)));
                item.append(link);
                list.append(item);
            });
            channelsLoaded = true;
            Holder.run();
        },
        complete: function() {
            $('.spinner').hide();
        }
    });
}

var nowPlayingId = false
function loadNowPlaying() {
    $.ajax({
        url: WEBDIR + 'kodi/NowPlaying',
        type: 'get',
        dataType: 'json',
        success: function(data) {
            if (data == null) {
                $('#nowplaying').hide();
                $('a[href="#playlist"]').parent().hide();
                return;
            }
            if (nowPlayingId != data.itemInfo.item.id) {
                var nowPlayingThumb = encodeURIComponent(data.itemInfo.item.thumbnail);
                var thumbnail = $('#nowplaying .thumb img').attr('alt', data.itemInfo.item.label);
                if (nowPlayingThumb == '') {
                    thumbnail.attr('src', 'holder.js/140x140/text:No artwork');
                    thumbnail.attr('width', '140').attr('height', '140');
                    Holder.run();
                } else {
                    switch(data.itemInfo.item.type) {
                        case 'episode':
                            thumbnail.attr('src', WEBDIR + 'kodi/GetThumb?w=150&h=100&thumb='+nowPlayingThumb);
                            thumbnail.attr('width', '150').attr('height', '75');
                            break;
                        case 'movie':
                            thumbnail.attr('src', WEBDIR + 'kodi/GetThumb?w=100&h=150&thumb='+nowPlayingThumb);
                            thumbnail.attr('width', '100').attr('height', '150');
                            break;
                        case 'song':
                            thumbnail.attr('src', WEBDIR + 'kodi/GetThumb?w=180&h=180&thumb='+nowPlayingThumb);
                            thumbnail.attr('width', '180').attr('height', '180');
                            break;
                        default:
                            thumbnail.attr('src', WEBDIR + 'kodi/GetThumb?w=140&h=140&thumb='+nowPlayingThumb);
                            thumbnail.attr('width', '140').attr('height', '140');
                    }
                }
                /*if (data.itemInfo.item.fanart) {
                    var background = encodeURIComponent(data.itemInfo.item.fanart)
                    background = WEBDIR + 'kodi/GetThumb?w=1150&h=640&o=10&thumb='+background;
                    $('#nowplaying').css({'background-image':'url('+background+')'});
                }*/
            }

            if (data.playerInfo.speed == 1) {
                $('#nowplaying i.icon-play').removeClass().addClass('fa fa-pause')
            } else {
                $('#nowplaying i.icon-pause').removeClass().addClass('fa fa-play')
            }
            if (data.app.muted) {
                $('#nowplaying i.icon-volume-up').removeClass().addClass('fa fa-volume-off')
            } else {
                $('#nowplaying i.icon-volume-off').removeClass().addClass('fa fa-volume-up')
            }

            var playingTime = pad(data.playerInfo.time.hours, 2) + ':' +
                              pad(data.playerInfo.time.minutes, 2) + ':' +
                              pad(data.playerInfo.time.seconds, 2);
            var totalTime = pad(data.playerInfo.totaltime.hours, 2) + ':' +
                            pad(data.playerInfo.totaltime.minutes, 2) + ':' +
                            pad(data.playerInfo.totaltime.seconds, 2);
            var itemTime = $('#nowplaying #player-item-time').html(playingTime + ' / ' + totalTime);

            var itemTitel = $('#nowplaying #player-item-title')
            var itemSubtitel = $('#nowplaying #player-item-subtitle')
            var playingTitle = '';
            var playingSubtitle = '';
            if (data.itemInfo.item.type == 'episode') {
                playingTitle = data.itemInfo.item.label;
                playingSubtitle = data.itemInfo.item.showtitle + ' ' +
                                  data.itemInfo.item.season + 'x' +
                                  data.itemInfo.item.episode;
            }
            else if (data.itemInfo.item.type == 'movie') {
                playingTitle = data.itemInfo.item.label;
                playingSubtitle  = data.itemInfo.item.year;
            }
            else if (data.itemInfo.item.type == 'song') {
                playingTitle = data.itemInfo.item.title;
                playingSubtitle  = data.itemInfo.item.artist[0] + ' (' + data.itemInfo.item.album + ')';
            } else {
                playingTitle = data.itemInfo.item.label;
            }
            itemTitel.html(playingTitle);
            itemSubtitel.html(playingSubtitle);

            var progressBar = $('#nowplaying #player-progressbar .bar');
            progressBar.css('width', data.playerInfo.percentage + '%');

            //Fake update the slider
            $('.slider-selection').css({
                "width":data.app.volume+'%',
                'left':'0%'
            });
            $('.slider-handle').css({
                'left': data.app.volume+'%',
            });

            var select = $('#audio').html('')
            select.parent().hide();
            if (data.playerInfo.audiostreams && data.playerInfo.audiostreams.length > 1) {
                var current = data.playerInfo.currentaudiostream.index;
                $.each(data.playerInfo.audiostreams, function (i, item) {
                    var option = $('<option>').html(item.name).val(item.index);
                    if (item.index==current) option.attr('selected','selected');
                    select.append(option);
                });
                select.parent().show();
            }
            var select = $('#subtitles').html('')
            select.parent().hide();
            if (data.playerInfo.subtitles && data.playerInfo.subtitles.length > 0) {
                data.playerInfo.subtitles.unshift({'index':'off','name':'None'});
                var current = data.playerInfo.currentsubtitle.index;
                if (data.playerInfo.subtitleenabled==false || current==='') current = 'off';
                $.each(data.playerInfo.subtitles, function (i, item) {
                    var name = item.name;
                    if (item.language && item.name != item.language) name += ' [' + item.language + ']'
                    var option = $('<option>').html(name).val(item.index);
                    if (item.index==current) option.attr('selected','selected');
                    select.append(option);
                });
                select.parent().show();
            }

            $('[data-player-control]').attr('disabled', false);

            if (nowPlayingId != data.itemInfo.item.id) {
                loadPlaylist(data.itemInfo.item.type=='song'?'audio':'video');
                nowPlayingId = data.itemInfo.item.id;
            }
            $('#nowplaying').slideDown();
        }
    });
}

function loadPlaylist(type){
    $.ajax({
        url: WEBDIR + 'kodi/Playlist/' + type,
        type: 'get',
        dataType: 'json',
        success: function(data) {
            var playlist = $('#playlist-table tbody').html('');

            if (data.items == undefined || data.limits.total == 0) {
                playlist.html('<tr><td colspan="4">Playlist is empty</td></tr>');
                return;
            }
            $('a[href="#playlist"]').parent().show();

            $.each(data.items, function(i, item){
                var listItem = $('<tr>').attr('title',item.title).click(function(e) {
                    e.preventDefault();
                    playlistJump(i);
                });

                if (item.id == nowPlayingId) {
                    listItem.addClass('info active');
                }

                if (item.type == 'song') {
                    listItem.append(
                        $('<td>').html(shortenText(item.title,90)).prepend(
                            $('<i>').addClass('fa fa-times remove').click(function(e) {
                                e.stopPropagation();
                                removeItem(i);
                                nowPlaying = null;
                            })
                        ),
                        $('<td>').html(item.artist[0]),
                        $('<td>').html(item.album),
                        $('<td>').html(parseSec(item.duration)),
                        $('<td>').append($('<i>').addClass('fa fa-align-justify handle'))
                    );
                } else {
                    var label = item.label + ' (' + item.year + ')';
                    if (item.episode != -1) {
                        label = item.showtitle + ': ' +
                                item.season + 'x' + item.episode + '. ' +
                                item.label
                    }
                    listItem.append(
                        $('<td>').html(label).attr('colspan','3'),
                        $('<td>').html(parseSec(item.runtime))
                    );
                }
                playlist.append(listItem);
            });
        }
    });
}

function playItem(item, type) {
    type = typeof type !== 'undefined' ? '&type='+type : '';
    $.get(WEBDIR + 'kodi/PlayItem?item='+item+type);
}

function queueItem(item, type) {
    type = typeof type !== 'undefined' ? '&type='+type : '';
    $.get(WEBDIR + 'kodi/QueueItem?item='+item+type);
    nowPlayingId = null;
}

function removeItem(item) {
    $.get(WEBDIR + 'kodi/RemoveItem?item='+item);
    nowPlayingId = null;
}

function playlistJump(position) {
    $.get(WEBDIR + 'kodi/ControlPlayer/jump/'+position);
}

function errorHandler() {
    $('.spinner').hide();
    notify('Error','Error connecting to kodi','error');
    moviesLoading = false;
    return false;
}

function substring(str, part) {
    return str.substring(0, part.length) == part;
}

function loadShowFromHash(hash) {
    options = {'filter': searchString}

    if (substring(hash, '#tvshow-')) {
        var tvShowId = hash.substring(8);
        loadEpisodes({'tvshowid':tvShowId})
    }
}

function executeAddon(addon, cmd0, cmd1) {
     confirm('Execute: ' + addon + ' with parameter: ' + cmd0 + ' ' + cmd1);
     $.get(WEBDIR + 'kodi/ExecuteAddon?addon='+ addon + '&cmd0=' + cmd0 + '&cmd1=' + cmd1);
}

function Enable_DisableAddon(addonid, enabled) {
    $.get(WEBDIR + 'kodi/Enable_DisableAddon/'+ addonid + '/' + enabled, function(i){
    });

}

function GetAddons() {
    $.ajax({
        'url': WEBDIR + 'kodi/GetAddons',
            'dataType': 'json',
            'success': function (response) {
                $('#addons-grid').html("");

                $.each(response, function (i, addon) {
                    var row = $('<li>').attr('title', addon.name);
                    var addonAnchor = $('<a>').attr('href', '#').click(function (e) {
                        e.preventDefault();
                        loadAddons(addon);
                    });
                    var src = 'holder.js/100x150/text:No artwork';
                    if (addon.thumbnail) {
                        src = WEBDIR + 'kodi/GetThumb?w=100&h=150&thumb=' + encodeURIComponent(addon.thumbnail);
                    }

                    addonAnchor.append($('<img>').attr('src', src).addClass('thumbnail'));
                    addonAnchor.append($('<h6>').addClass('title').html(shortenText(addon.name, 17)));
                    row.append(addonAnchor);
                    $('#addons-grid').append(row);
                });
                $('.spinner').hide();
                Holder.run();
            }
    });
}

function loadAddons(addon) {
    var head = addon.name;
    var poster = WEBDIR + 'kodi/GetThumb?w=133&h=200&thumb=' + encodeURIComponent(addon.thumbnail);
    var info = $('<div>')
    var description = $('<p>').html('<b>Description:</b> ' + addon.description);
    var type = $('<p>').html('<b>Type:</b> ' + addon.type);
    var author = $('<p>').html('<b>Author:</b> ' + addon.author);
    var version = $('<p>').html('<b>Version:</b> ' + addon.version);
    var rating = $('<p>').html('<b>Rating:</b> ' + addon.rating);
    var summary = $('<p>').html('<b>Summary:</b> ' + addon.summary);
    var searchform = $('<form>').attr('id', 'modal_addon_searchform').html('<input name="search" id="modal_addon_search" placeholder="search" type="text" data-addonid=' + addon.addonid +'>');
    var search = $('<input>').html('<input name="search" id="modal_addon_search" placeholder="search" type="text">');
    var img = $('<img>').attr('src', poster).addClass('thumbnail, modal-movie-poster pull-left');
    var content = $('<div>');
    var buttontxt = '';

    info.append(
        img,
        description,
        type,
        author,
        version,
        summary,
        rating,
        searchform
        );

    var buttons = {
        'Open': function () {
            executeAddon(addon.addonid);
            hideModal();
        }
    }

    if (addon.enabled === true) {
        $.extend(buttons, {
            'Disable addon': function () {
                Enable_DisableAddon(addon.addonid, 0)
                hideModal();
                reloadTab();
            }
        });
    } else {
        $.extend(buttons, {
            'Enable addon': function () {
                Enable_DisableAddon(addon.addonid, 1)
                hideModal();
                reloadTab();
            }
        });

    }

    content.append(img, info);
    showModal(head, content.addClass('modal-body-addon'), buttons);

}

function reloadTab() {
    options = {'filter': searchString}

    if ($('#movies').is(':visible')) {
        $('.search').attr('placeholder', "Search movies")
        loadMovies(options);
    } else if ($('#shows').is(':visible')) {
        $('.search').attr('placeholder', "Search shows")
        loadShows(options);
    } else if ($('#episodes').is(':visible')) {
        options = $.extend(options, {'tvshowid': currentShow});
        loadEpisodes(options);
    } else if ($('#artists').is(':visible')) {
        $('.search').attr('placeholder', "Search artists")
        loadArtists(options);
    } else if ($('#albums').is(':visible')) {
        $('.search').attr('placeholder', "Search albums")
        loadAlbums(options);
    } else if ($('#songs').is(':visible')) {
        $('.search').attr('placeholder', "Search songs")
        loadSongs();
    } else if ($('#pvr').is(':visible')) {
        loadChannels();
    } else if ($('#addons').is(':visible')) {
        $('.search').attr('placeholder', "Search")
        GetAddons();
    }
}

$(document).on("submit","#modal_addon_searchform",function (e) {
    e.preventDefault();
    search = $('#modal_addon_search').val()
    addonid = $('#modal_addon_search').attr('data-addonid');
    if (search.length >= 1) {
        executeAddon(addonid, search);
        search.val('');
    } else {
        executeAddon(addonid);
    }
});
