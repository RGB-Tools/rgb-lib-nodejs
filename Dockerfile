FROM rust:1.81-slim-bookworm

RUN apt-get update -y \
    && apt-get install -y \
        cmake \
        python3 \
        pkg-config \
        make \
        perl \
        g++ \
        git \
        wget \
        libssl-dev \
        libzmq3-dev \
        libpcre3-dev \
        libpcre2-dev \
        libpq-dev \
        nodejs \
        npm

RUN wget http://prdownloads.sourceforge.net/swig/swig-4.1.1.tar.gz && \
    tar xf swig-*.tar.gz && \
    cd swig-* && \
    ./configure && make -j12 && \
    make install

WORKDIR /rgb-lib-nodejs/

COPY . .

RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
