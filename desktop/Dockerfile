# Extended LinuxServer WebTop with command execution capabilities
FROM linuxserver/webtop:ubuntu-xfce

# Install additional tools for automation
RUN apt-get update && apt-get install -y \
    xdotool \
    scrot \
    imagemagick \
    x11-utils \
    openssh-server \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH for command execution
RUN mkdir /var/run/sshd && \
    echo 'root:admin123' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Add script to start SSH
RUN echo '#!/bin/bash\n/usr/sbin/sshd -D' > /custom-cont-init.d/50-sshd && \
    chmod +x /custom-cont-init.d/50-sshd

EXPOSE 22