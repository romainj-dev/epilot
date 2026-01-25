'use client'

import { Button } from '@/components/ui/button/Button'
import styles from './UserPopover.module.scss'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover/Popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar/Avatar'
import { LogOut, User } from 'lucide-react'
import { signOut } from 'next-auth/react'

export function UserPopover() {
  const score = 0
  const mockUser = {
    email: 'player@bitbet.io',
    username: 'CryptoTrader42',
  }

  async function handleLogout() {
    await signOut({ callbackUrl: '/' })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={styles.avatarButton}>
          <Avatar className={styles.avatar}>
            <AvatarFallback className={styles.avatarFallback}>
              <User className={styles.avatarIcon} />
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={styles.popoverContent}>
        <div>
          <div className={styles.userInfo}>
            <p className={styles.username}>{mockUser.username}</p>
            <p className={styles.email}>{mockUser.email}</p>
          </div>

          <div className={styles.statsBox}>
            <div className={styles.statsRow}>
              <span className={styles.statsLabel}>Current Score</span>
              <span className={styles.statsValue}>
                {score >= 0 ? '+' : ''}
                {score}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            <LogOut className={styles.logoutIcon} />
            Log out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
